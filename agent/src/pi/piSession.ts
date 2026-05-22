import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
import * as nodeUrl from "node:url";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const DEFAULT_MODEL = "solar-pro3";
const PROVIDER = "upstage";

const systemPrompt = [
  "당신은 공시리(Gongsiri) Pi agent입니다.",
  "항상 1인칭 화자로 답하고, 자신을 '공시리'라고 표현하세요.",
  "예: '저 공시리가 확인한 바로는...', '공시리가 공시와 주식 정보를 함께 보면...'",
  "한국 상장사 공시 기반 위험 점검 report와 QA를 생성합니다.",
  "호출자가 제공한 JSON context만 근거로 사용하세요.",
  "작전주를 확정적으로 예측한다고 말하지 말고 공시 기반 위험 신호로 표현하세요.",
  "브라우저 데모에 바로 표시할 수 있도록 간결한 한국어 Markdown으로 답하세요.",
].join("\n");

export type PiRunResult = {
  text: string;
  model: string;
};

const requireApiKey = (): string => {
  const key = process.env.UPSTAGE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "저 공시리가 답변을 준비하려면 UPSTAGE_API_KEY가 필요합니다.",
    );
  }
  return key;
};

const createRegistry = (apiKey: string, modelId: string): ModelRegistry => {
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

// Skill shape matching @earendil-works/pi-coding-agent Skill interface
type GongsiriSkill = {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  sourceInfo: {
    path: string;
    source: string;
    scope: "project";
    origin: "top-level";
    baseDir?: string;
  };
  disableModelInvocation: boolean;
};

const resolveAgentRoot = (): string => {
  // resolve agent root from this compiled file's location: dist/pi/ → dist/ → agent root
  const currentDir =
    typeof __dirname !== "undefined"
      ? __dirname
      : nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url));
  return nodePath.resolve(currentDir, "..", "..");
};

const loadGongsiriSkills = (skillsDir: string): GongsiriSkill[] => {
  if (!nodeFs.existsSync(skillsDir)) {
    return [];
  }
  const skills: GongsiriSkill[] = [];
  for (const entry of nodeFs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = nodePath.join(skillsDir, entry.name, "SKILL.md");
    if (!nodeFs.existsSync(skillMd)) continue;
    const content = nodeFs.readFileSync(skillMd, "utf8");
    // Parse frontmatter name/description
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const descMatch = content.match(/^description:\s*(.+)$/m);
    skills.push({
      name: nameMatch?.[1]?.trim() ?? entry.name,
      description: descMatch?.[1]?.trim() ?? "",
      filePath: skillMd,
      baseDir: nodePath.join(skillsDir, entry.name),
      sourceInfo: {
        path: skillMd,
        source: "gongsiri-pi-skills",
        scope: "project",
        origin: "top-level",
        baseDir: nodePath.join(skillsDir, entry.name),
      },
      disableModelInvocation: false,
    });
  }
  return skills;
};

export const runPiSession = async (prompt: string): Promise<PiRunResult> => {
  const modelId = process.env.UPSTAGE_MODEL?.trim() || DEFAULT_MODEL;
  const registry = createRegistry(requireApiKey(), modelId);
  const model = registry.find(PROVIDER, modelId);
  if (!model) {
    throw new Error("저 공시리가 사용할 답변 모델을 찾지 못했습니다.");
  }

  let text = "";
  const agentRoot = resolveAgentRoot();
  const agentDir = nodePath.join(agentRoot, ".runtime", "pi");
  const skillsDir = nodePath.join(agentRoot, ".pi", "skills");

  const loader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir,
    noExtensions: true,
    noSkills: false,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => systemPrompt,
    skillsOverride: (current: {
      skills: GongsiriSkill[];
      diagnostics: unknown[];
    }) => {
      const gongsiriSkills = loadGongsiriSkills(skillsDir);
      return {
        skills: [...current.skills, ...gongsiriSkills],
        diagnostics: current.diagnostics,
      };
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

  const unsubscribe = session.subscribe((event: unknown) => {
    const candidate = event as {
      type?: string;
      assistantMessageEvent?: { type?: string; delta?: string };
    };
    if (
      candidate.type === "message_update" &&
      candidate.assistantMessageEvent?.type === "text_delta" &&
      candidate.assistantMessageEvent.delta
    ) {
      text += candidate.assistantMessageEvent.delta;
    }
  });

  try {
    await session.prompt(prompt, { source: "rpc" });
    const finalText = text.trim();
    if (!finalText) {
      throw new Error("저 공시리가 답변 본문을 받지 못했습니다.");
    }
    return { text: finalText, model: `${PROVIDER}/${modelId}` };
  } finally {
    unsubscribe();
    session.dispose();
  }
};
