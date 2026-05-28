import * as nodePath from "node:path";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { resolveAgentRoot } from "../agentPaths.js";
import { stripNonJsonPrefix } from "../utils/parseHelpers.js";
import { loadGongsiriSystemPrompt } from "./systemPrompt.js";
import type { SystemPromptContext } from "./systemPrompt.js";

export const DEFAULT_MODEL = "solar-pro3";
export const PROVIDER = "upstage";

export type TraceLogEntry = {
  turn: number;
  toolName: string;
  latencyMs: number;
  status: string;
};

export type PiRunResult = {
  text: string;
  model: string;
  warnings?: string[];
  toolTraces?: TraceLogEntry[];
};

export type PiSessionOptions = {
  modelId: string;
  agentDir: string;
  promptCtx?: SystemPromptContext;
};

export const requireApiKey = (): string => {
  const key = process.env.UPSTAGE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "저 공시리가 답변을 준비하려면 UPSTAGE_API_KEY가 필요합니다.",
    );
  }
  return key;
};

export const createRegistry = (
  apiKey: string,
  modelId: string,
): ModelRegistry => {
  const authStorage = AuthStorage.inMemory();
  authStorage.setRuntimeApiKey(PROVIDER, apiKey);
  const registry = ModelRegistry.inMemory(authStorage);
  registry.registerProvider(PROVIDER, {
    name: "Upstage",
    baseUrl: process.env.UPSTAGE_BASE_URL ?? "https://api.upstage.ai/v1",
    apiKey: "UPSTAGE_API_KEY",
    api: "openai-completions",
    authHeader: true,
    models: [
      {
        id: modelId,
        name: modelId,
        api: "openai-completions",
        baseUrl: process.env.UPSTAGE_BASE_URL ?? "https://api.upstage.ai/v1",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
        compat: {
          supportsDeveloperRole: false,
          supportsReasoningEffort: true,
          supportsStore: false,
          maxTokensField: "max_tokens",
        },
      },
    ],
  });
  return registry;
};

export type PiSession = Awaited<
  ReturnType<typeof createAgentSession>
>["session"];

const buildSystemPrompt = (ctx?: SystemPromptContext): string => {
  if (!ctx) {
    return loadGongsiriSystemPrompt({
      mode: "qa",
      traceId: "bootstrap",
      contractVersion: "v2",
      todayDate: new Date().toISOString().slice(0, 10),
      workingDirectory: process.cwd(),
    });
  }
  return loadGongsiriSystemPrompt(ctx);
};

// qa/checklist 전용 세션 — noTools: "all" 유지
export const createPiSession = async (
  options: PiSessionOptions,
  skillName: string,
): Promise<PiSession> => {
  const registry = createRegistry(requireApiKey(), options.modelId);
  const model = registry.find(PROVIDER, options.modelId);
  if (!model) {
    throw new Error("저 공시리가 사용할 답변 모델을 찾지 못했습니다.");
  }
  const loader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: options.agentDir,
    noExtensions: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => buildSystemPrompt(options.promptCtx),
    skillsOverride: (current: {
      skills: Array<{ name: string }>;
      diagnostics: unknown;
    }) => {
      const target = current.skills.find(
        (s: { name: string }) => s.name === skillName,
      );
      if (!target)
        throw new Error(`SDK가 ${skillName} skill을 발견하지 못했습니다.`);
      return { skills: [target], diagnostics: current.diagnostics };
    },
  });
  await loader.reload();
  const { session } = await createAgentSession({
    model,
    thinkingLevel: "high",
    authStorage: registry.authStorage,
    modelRegistry: registry,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 1 },
    }),
    noTools: "all",
  });
  return session;
};

// report/qa/checklist_explanation 공용 — tools 유무에 따라 customTools/noTools 분기
export const runPiSession = async (
  prompt: string,
  skillName: string,
  tools: ToolDefinition[] = [],
  promptCtx?: SystemPromptContext,
): Promise<PiRunResult> => {
  const modelId = process.env.UPSTAGE_MODEL?.trim() || DEFAULT_MODEL;
  const registry = createRegistry(requireApiKey(), modelId);
  const model = registry.find(PROVIDER, modelId);
  if (!model) {
    throw new Error("저 공시리가 사용할 답변 모델을 찾지 못했습니다.");
  }

  const agentRoot = resolveAgentRoot();
  const agentDir = nodePath.join(agentRoot, ".runtime", "pi");

  const loader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir,
    noExtensions: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => buildSystemPrompt(promptCtx),
    skillsOverride: (current: {
      skills: Array<{ name: string }>;
      diagnostics: unknown;
    }) => {
      const target = current.skills.find(
        (s: { name: string }) => s.name === skillName,
      );
      if (!target)
        throw new Error(`SDK가 ${skillName} skill을 발견하지 못했습니다.`);
      return { skills: [target], diagnostics: current.diagnostics };
    },
  });
  await loader.reload();

  const baseOptions = {
    model,
    thinkingLevel: "high" as const,
    authStorage: registry.authStorage,
    modelRegistry: registry,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 1 },
    }),
  };
  const sessionOptions =
    tools.length > 0
      ? { ...baseOptions, customTools: tools }
      : { ...baseOptions, noTools: "all" as const };

  const { session } = await createAgentSession(sessionOptions);

  let currentTurnText = "";
  let finalText = "";
  let turnCount = 0;
  const MAX_TURNS = 5;
  const toolTraces: TraceLogEntry[] = [];
  const abortController = new AbortController();

  const traceVal = (process.env.GONGSIRI_TRACE_STDOUT ?? "true").toLowerCase();
  const traceEnabled =
    traceVal !== "0" && traceVal !== "false" && traceVal !== "off";
  const tracePrefix = `pi:${promptCtx?.mode ?? "run"}:${(promptCtx?.traceId ?? "--------").slice(0, 8)}`;
  const traceLog = (msg: string) => {
    if (traceEnabled) console.log(`[${tracePrefix}] ${msg}`);
  };

  const sessionStartMs = Date.now();

  const unsubscribe = session.subscribe((event: unknown) => {
    const candidate = event as {
      type?: string;
      assistantMessageEvent?: { type?: string; delta?: string };
      message?: unknown; // SDK turn_end의 message는 문자열이 아닌 메시지 객체
      toolResults?: Array<{
        toolName?: string;
        latencyMs?: number;
        status?: string;
        input?: Record<string, unknown>;
        output?: unknown;
      }>;
    };

    if (candidate.type === "turn_start") {
      currentTurnText = "";
      traceLog(`turn ${turnCount + 1} start`);
    }

    if (
      candidate.type === "message_update" &&
      candidate.assistantMessageEvent?.type === "text_delta" &&
      candidate.assistantMessageEvent.delta
    ) {
      currentTurnText += candidate.assistantMessageEvent.delta;
    }

    if (candidate.type === "turn_end") {
      // Pi SDK turn_end의 event.message는 메시지 객체({role, content, ...})이므로
      // 문자열 텍스트는 message_update 이벤트로 누적한 currentTurnText를 사용한다.
      finalText = currentTurnText;

      if (candidate.toolResults) {
        for (const tr of candidate.toolResults) {
          const paramKeys = tr.input
            ? `{${Object.keys(tr.input).join(", ")}}`
            : "{}";
          traceLog(`tool_call ${tr.toolName ?? "unknown"}(${paramKeys})`);
          const outputLen =
            tr.output != null ? JSON.stringify(tr.output).length : 0;
          traceLog(
            `tool_result ok=${tr.status === "success"} (${outputLen} bytes)`,
          );
          toolTraces.push({
            turn: turnCount,
            toolName: tr.toolName ?? "unknown",
            latencyMs: tr.latencyMs ?? 0,
            status: tr.status ?? "unknown",
          });
        }
      }

      traceLog(`turn ${turnCount + 1} end`);
      turnCount++;
      if (turnCount >= MAX_TURNS) {
        abortController.abort();
      }
    }
  });

  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), 60_000),
  );

  try {
    const raceResult = await Promise.race([
      session
        .prompt(prompt, { source: "rpc" })
        .then(() => ({ timedOut: false as const })),
      timeoutPromise,
    ]);

    if (raceResult.timedOut) {
      traceLog(
        `done turns=${turnCount} elapsed=${Date.now() - sessionStartMs}ms TIMEOUT`,
      );
      return {
        text: "",
        model: `${PROVIDER}/${modelId}`,
        warnings: ["agent_timeout_60s"],
        toolTraces,
      };
    }

    traceLog(
      `done turns=${turnCount} elapsed=${Date.now() - sessionStartMs}ms`,
    );
    const stripped = stripNonJsonPrefix(finalText.trim());
    return {
      text: stripped || finalText.trim(),
      model: `${PROVIDER}/${modelId}`,
      toolTraces,
    };
  } finally {
    unsubscribe();
    session.dispose();
  }
};
