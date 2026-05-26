import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadLocalEnvFiles } from "./env/loadLocalEnv.js";
import type {
  AgentHealthResponse,
  AgentServiceEvidence,
  AgentServiceMode,
  AgentServiceRequest,
  AgentServiceResponse,
} from "./contracts/agentService.js";
import { runPiSession } from "./pi/piSession.js";
import { runQaTurn, getWarmSessionsStats } from "./pi/qaSession.js";
import { buildPrompt } from "./agentPrompt.js";
import { AgentResponseParseError, parseModeResult } from "./agentModeParser.js";
import {
  AgentRequestValidationError,
  contractVersion,
  evidenceFrom,
  Incoming,
  json,
  nowIso,
  readBody,
  ResponseLike,
  traceId,
  validate,
} from "./agentHttpCore.js";
import { createDisclosureScheduler } from "./scheduler/disclosureScheduler.js";
import { runDisclosureMonitoring } from "./triggers/runDisclosureMonitoring.js";

loadLocalEnvFiles();

const HOST =
  process.env.GONGSIRI_AGENT_HOST ?? process.env.AGENT_HTTP_HOST ?? "127.0.0.1";
const PORT = Number(
  process.env.GONGSIRI_AGENT_PORT ??
    process.env.AGENT_HTTP_PORT ??
    process.env.PORT ??
    "8787",
);

const failure = (
  request: Partial<AgentServiceRequest> | undefined,
  mode: AgentServiceMode,
  code: AgentServiceResponse extends infer R
    ? R extends { ok: false; error: { code: infer C } }
      ? C
      : never
    : never,
  message: string,
): AgentServiceResponse => ({
  ok: false,
  mode,
  traceId: traceId(request),
  contractVersion: contractVersion(request),
  observedAt: nowIso(),
  markdown: "",
  text: "",
  warnings: [],
  error: { code, message },
  evidence: evidenceFrom(request),
});

const successEvidence = (
  request: AgentServiceRequest,
  mode: AgentServiceMode,
  model: string,
): AgentServiceEvidence[] => [
  ...evidenceFrom(request),
  {
    source: "pi_sdk_agent_service",
    mode,
    strictPiSdk: true,
    noTools: "all",
    model,
  },
];

const handleAgent = async (
  mode: AgentServiceMode,
  req: Incoming,
  res: ResponseLike,
): Promise<void> => {
  let request: AgentServiceRequest | undefined;
  try {
    const rawBody = await readBody(req);
    request = validate(JSON.parse(rawBody || "{}"), mode);
    let result: import("./pi/piSession.js").PiRunResult;
    if (mode === "qa" && request.mode === "qa" && request.conversationKey) {
      result = await runQaTurn(
        request.conversationKey,
        buildPrompt(request),
        request.priorTurns ?? [],
      );
    } else {
      result = await runPiSession(buildPrompt(request));
    }
    const parsed = parseModeResult(mode, result.text, request);
    json(res, 200, {
      ok: true,
      mode,
      traceId: traceId(request),
      contractVersion: contractVersion(request),
      observedAt: nowIso(),
      markdown: parsed.markdown,
      text: parsed.markdown,
      warnings: parsed.warnings,
      data: parsed.data,
      evidence: successEvidence(request, mode, result.model),
    } satisfies AgentServiceResponse);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "저 공시리가 요청을 완료하지 못했습니다.";
    const code =
      error instanceof AgentRequestValidationError
        ? "invalid_request"
        : error instanceof AgentResponseParseError
          ? "pi_agent_malformed_output"
          : message.includes("UPSTAGE_API_KEY")
            ? "missing_env"
            : request
              ? "pi_agent_error"
              : "invalid_request";
    json(
      res,
      code === "invalid_request" ? 400 : 500,
      failure(request, mode, code, message),
    );
  }
};

export const createAgentHttpServer = () =>
  createServer((rawReq, rawRes) => {
    const req = rawReq as unknown as Incoming;
    const res = rawRes as unknown as ResponseLike;
    const path = req.url?.split("?")[0] ?? "/";
    if (req.method === "GET" && path === "/health") {
      const stats = getWarmSessionsStats();
      json(res, 200, {
        ok: true,
        service: "gongsiri-pi-agent",
        contractVersion: contractVersion(),
        observedAt: nowIso(),
        warmSessions: stats.entries,
        warmSessionsSize: stats.size,
      } satisfies AgentHealthResponse);
      return;
    }

    if (
      (path === "/report" ||
        path === "/qa" ||
        path === "/checklist-explanation") &&
      req.method !== "POST"
    ) {
      const mode =
        path === "/qa"
          ? "qa"
          : path === "/checklist-explanation"
            ? "checklist_explanation"
            : "report";
      json(
        res,
        405,
        failure(
          undefined,
          mode,
          "method_not_allowed",
          `저 공시리가 ${path}는 POST 요청만 받을 수 있습니다.`,
        ),
      );
      return;
    }

    if (req.method === "POST" && path === "/report") {
      void handleAgent("report", req, res);
      return;
    }
    if (req.method === "POST" && path === "/qa") {
      void handleAgent("qa", req, res);
      return;
    }
    if (req.method === "POST" && path === "/checklist-explanation") {
      void handleAgent("checklist_explanation", req, res);
      return;
    }

    json(
      res,
      404,
      failure(
        undefined,
        "report",
        "not_found",
        "저 공시리가 찾을 수 없는 경로입니다.",
      ),
    );
  });

const STOCK_MASTER_PATH = fileURLToPath(
  new URL("../../assets/stock_master.json", import.meta.url),
);

type StockMasterEntry = {
  corp_name: string;
  stock_code: string;
  corp_code: string;
  market: string;
};

const loadStockMaster = (): Record<string, StockMasterEntry> => {
  try {
    const raw = readFileSync(STOCK_MASTER_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, StockMasterEntry>;
  } catch {
    return {};
  }
};

export const startAgentHttpServer = (): void => {
  const server = createAgentHttpServer();

  const startedSchedulers: Array<{ stop(): void }> = [];

  if (process.env.GONGSIRI_CRON_ENABLED !== "false") {
    const master = loadStockMaster();
    const entries = Object.entries(master);
    for (const [keyword, entry] of entries) {
      const scheduler = createDisclosureScheduler({
        run: runDisclosureMonitoring,
      });
      const started = scheduler.start({
        keyword,
        corpCode: entry.corp_code,
      });
      startedSchedulers.push(started);
    }
    if (entries.length > 0) {
      console.log(
        `[scheduler] started for ${entries.length} keywords (interval=${process.env.GONGSIRI_SCHEDULER_INTERVAL_MINUTES ?? "30"}m)`,
      );
    }
  }

  process.on("SIGTERM", () => {
    startedSchedulers.forEach((s) => s.stop());
  });

  server.listen(PORT, HOST, () => {
    console.log(`공시리 Pi agent service listening on http://${HOST}:${PORT}`);
  });
};
