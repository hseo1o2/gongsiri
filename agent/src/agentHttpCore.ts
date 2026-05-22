import { randomUUID } from "node:crypto";
import type { AgentServiceEvidence, AgentServiceMode, AgentServiceRequest } from "./contracts/agentService.js";
import type { ContractVersion } from "./contracts/request.js";

const CONTRACT_VERSION: ContractVersion = "v1";
const MAX_BODY_BYTES = 3_000_000;

type JsonObject = Record<string, unknown>;
export type Incoming = {
  method?: string;
  url?: string;
  on(event: "data", listener: (chunk: Uint8Array | string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
};

export type ResponseLike = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

export class AgentRequestValidationError extends Error {}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const nowIso = (): string => new Date().toISOString();
export const traceId = (request?: Partial<AgentServiceRequest>): string => request?.traceId || randomUUID();
export const contractVersion = (request?: Partial<AgentServiceRequest>): ContractVersion =>
  request?.contractVersion === "v1" ? "v1" : CONTRACT_VERSION;

export const json = (res: ResponseLike, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
};

export const evidenceFrom = (request?: Partial<AgentServiceRequest>): AgentServiceEvidence[] =>
  Array.isArray(request?.evidence) ? request.evidence.filter(isObject) : [];

export const readBody = async (req: Incoming): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: string[] = [];
    let total = 0;
    req.on("data", (chunk) => {
      const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      total += text.length;
      if (total > MAX_BODY_BYTES) {
        reject(new AgentRequestValidationError("저 공시리가 요청 본문이 너무 커서 처리하지 못했습니다."));
        return;
      }
      chunks.push(text);
    });
    req.on("end", () => resolve(chunks.join("")));
    req.on("error", reject);
  });

export const contextFrom = (request: AgentServiceRequest): unknown => {
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

export const validate = (value: unknown, mode: AgentServiceMode): AgentServiceRequest => {
  if (!isObject(value)) {
    throw new AgentRequestValidationError("저 공시리가 읽을 수 있는 JSON 객체로 요청해 주세요.");
  }
  if (mode === "qa" && typeof value.question !== "string") {
    throw new AgentRequestValidationError("저 공시리가 답변하려면 question 문자열이 필요합니다.");
  }

  const request = { ...value, mode, contractVersion: contractVersion(value) } as AgentServiceRequest;
  if (contextFrom(request) === undefined) {
    throw new AgentRequestValidationError(
      "저 공시리가 분석하려면 backend-generated JSON context가 필요합니다."
    );
  }
  return request;
};
