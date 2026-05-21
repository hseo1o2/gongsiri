import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { loadLocalEnvFiles } from "./env/loadLocalEnv.js";
import type {
  AgentHealthResponse,
  AgentQaRequest,
  AgentReportRequest,
  AgentServiceEvidence,
  AgentServiceMode,
  AgentServiceRequest,
  AgentServiceResponse
} from "./contracts/agentService.js";
import type { ContractVersion } from "./contracts/request.js";
import { runPiSession } from "./pi/piSession.js";

loadLocalEnvFiles();

const CONTRACT_VERSION: ContractVersion = "v1";
const MAX_BODY_BYTES = 3_000_000;
const HOST = process.env.GONGSIRI_AGENT_HOST ?? process.env.AGENT_HTTP_HOST ?? "127.0.0.1";
const PORT = Number(process.env.GONGSIRI_AGENT_PORT ?? process.env.AGENT_HTTP_PORT ?? "8787");
const GONGSIRI_TONE_INSTRUCTION =
  "반드시 공시리 1인칭으로 말하세요. 사용자에게 직접 보이는 모든 문장은 '저 공시리가...' 또는 '공시리가...' 톤을 유지하고, 자신을 일반 agent가 아니라 '공시리'라고 부르세요.";

type Incoming = {
  method?: string;
  url?: string;
  on(event: "data", listener: (chunk: Uint8Array | string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
};

type ResponseLike = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

type JsonObject = Record<string, unknown>;

const nowIso = (): string => new Date().toISOString();
const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const traceId = (request?: Partial<AgentServiceRequest>): string => request?.traceId || randomUUID();
const contractVersion = (request?: Partial<AgentServiceRequest>): ContractVersion =>
  request?.contractVersion === "v1" ? "v1" : CONTRACT_VERSION;

const json = (res: ResponseLike, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
};

const evidenceFrom = (request?: Partial<AgentServiceRequest>): AgentServiceEvidence[] =>
  Array.isArray(request?.evidence) ? request.evidence.filter(isObject) : [];

const readBody = async (req: Incoming): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: string[] = [];
    let total = 0;

    req.on("data", (chunk) => {
      const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      total += text.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("저 공시리가 요청 본문이 너무 커서 처리하지 못했습니다."));
        return;
      }
      chunks.push(text);
    });
    req.on("end", () => resolve(chunks.join("")));
    req.on("error", reject);
  });

const contextFrom = (request: AgentServiceRequest): unknown => {
  if ("context" in request && request.context !== undefined) {
    return request.context;
  }
  if (request.bundle || request.normalizedDataBundle || request.analysisResult || request.preparation) {
    return {
      corpCode: request.corpCode,
      corpName: request.corpName,
      normalizedDataBundle: request.normalizedDataBundle ?? request.bundle,
      analysisResult: request.analysisResult,
      preparation: request.preparation
    };
  }
  return undefined;
};

const validate = (value: unknown, mode: AgentServiceMode): AgentServiceRequest => {
  if (!isObject(value)) {
    throw new Error("저 공시리가 읽을 수 있는 JSON 객체로 요청해 주세요.");
  }
  if (mode === "qa" && typeof value.question !== "string") {
    throw new Error("저 공시리가 답변하려면 question 문자열이 필요합니다.");
  }

  const request = { ...value, mode, contractVersion: contractVersion(value) } as AgentServiceRequest;
  if (contextFrom(request) === undefined) {
    throw new Error("저 공시리가 분석하려면 backend-generated JSON context가 필요합니다.");
  }
  return request;
};

const buildPrompt = (request: AgentServiceRequest): string => {
  const context = JSON.stringify(contextFrom(request), null, 2);

  if (request.mode === "qa") {
    return [
      "아래 backend-generated JSON context만 근거로 사용자의 질문에 답하세요.",
      GONGSIRI_TONE_INSTRUCTION,
      "답변에는 핵심 판단, 공시/주식 정보 근거, 투자 조언이 아니라는 고지를 포함하세요.",
      "근거가 부족하면 부족하다고 명시하세요.",
      `질문: ${(request as AgentQaRequest).question}`,
      "JSON context:",
      context
    ].join("\n\n");
  }

  return [
    "아래 backend-generated JSON context만 근거로 공시리 리포트 본문을 생성하세요.",
    GONGSIRI_TONE_INSTRUCTION,
    "형식: 요약, 핵심 위험 신호, 공시/주식 정보 근거, 단기 관찰 포인트, 고지 순서의 Markdown.",
    "analysisResult의 risk_score/risk_level/checklist가 있으면 반영하되 확정적 작전주 판정은 피하세요.",
    (request as AgentReportRequest).prompt
      ? `추가 작성 지시: ${(request as AgentReportRequest).prompt}`
      : "",
    "JSON context:",
    context
  ]
    .filter(Boolean)
    .join("\n\n");
};

const failure = (
  request: Partial<AgentServiceRequest> | undefined,
  mode: AgentServiceMode,
  code: AgentServiceResponse extends infer R
    ? R extends { ok: false; error: { code: infer C } }
      ? C
      : never
    : never,
  message: string
): AgentServiceResponse => ({
  ok: false,
  mode,
  traceId: traceId(request),
  contractVersion: contractVersion(request),
  observedAt: nowIso(),
  text: "",
  error: { code, message },
  evidence: evidenceFrom(request)
});

const successEvidence = (
  request: AgentServiceRequest,
  mode: AgentServiceMode,
  model: string
): AgentServiceEvidence[] => [
  ...evidenceFrom(request),
  { source: "pi_sdk_agent_service", mode, strictPiSdk: true, noTools: "all", model }
];

const handleAgent = async (mode: AgentServiceMode, req: Incoming, res: ResponseLike): Promise<void> => {
  let request: AgentServiceRequest | undefined;
  try {
    const rawBody = await readBody(req);
    request = validate(JSON.parse(rawBody || "{}"), mode);
    const result = await runPiSession(buildPrompt(request));
    json(res, 200, {
      ok: true,
      mode,
      traceId: traceId(request),
      contractVersion: contractVersion(request),
      observedAt: nowIso(),
      text: result.text,
      evidence: successEvidence(request, mode, result.model)
    } satisfies AgentServiceResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "저 공시리가 Pi SDK 요청을 완료하지 못했습니다.";
    const code = message.includes("UPSTAGE_API_KEY") ? "missing_env" : request ? "pi_agent_error" : "invalid_request";
    json(res, code === "invalid_request" ? 400 : 500, failure(request, mode, code, message));
  }
};

export const createAgentHttpServer = () =>
  createServer((rawReq, rawRes) => {
    const req = rawReq as unknown as Incoming;
    const res = rawRes as unknown as ResponseLike;
    const path = req.url?.split("?")[0] ?? "/";
    if (req.method === "GET" && path === "/health") {
      json(res, 200, {
        ok: true,
        service: "gongsiri-pi-agent",
        contractVersion: CONTRACT_VERSION,
        observedAt: nowIso()
      } satisfies AgentHealthResponse);
      return;
    }

    if ((path === "/report" || path === "/qa") && req.method !== "POST") {
      json(
        res,
        405,
        failure(undefined, path === "/qa" ? "qa" : "report", "method_not_allowed", `저 공시리가 ${path}는 POST 요청만 받을 수 있습니다.`)
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

    json(res, 404, failure(undefined, "report", "not_found", "저 공시리가 찾을 수 없는 경로입니다."));
  });

export const startAgentHttpServer = (): void => {
  const server = createAgentHttpServer();
  server.listen(PORT, HOST, () => {
    console.log(`공시리 Pi agent service listening on http://${HOST}:${PORT}`);
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startAgentHttpServer();
}
