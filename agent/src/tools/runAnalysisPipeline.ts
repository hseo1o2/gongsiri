import type { PipelineResult, PipelineResultFailure, PipelineTriggerRequest } from "../contracts/pipeline.js";
import { RUN_ANALYSIS_PIPELINE_TOOL_NAME } from "../contracts/pipeline.js";

type FetchResponseLike = {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
};

type FetchLike = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<FetchResponseLike>;

type CreateRunAnalysisPipelineToolOptions = {
  apiUrl?: string;
  endpointUrl?: string;
  fetchImpl?: FetchLike;
};

export type PipelineToolDefinition = {
  descriptor: {
    name: typeof RUN_ANALYSIS_PIPELINE_TOOL_NAME;
    description: string;
    endpoint: "POST /pipeline/trigger";
  };
  invoke(request: PipelineTriggerRequest): Promise<PipelineResult>;
};

const DEFAULT_CONTRACT_VERSION = "v1" as const;
const DEFAULT_ENDPOINT_URL = "http://127.0.0.1:8000/pipeline/trigger";

const resolveEndpointUrl = (options: CreateRunAnalysisPipelineToolOptions): string =>
  options.apiUrl ?? options.endpointUrl ?? process.env.GONGSIRI_PIPELINE_API_URL ?? DEFAULT_ENDPOINT_URL;

const resolveFetch = (options: CreateRunAnalysisPipelineToolOptions): FetchLike => {
  if (options.fetchImpl) {
    return options.fetchImpl;
  }

  if (typeof fetch === "function") {
    return fetch;
  }

  throw new Error("fetch API를 사용할 수 없습니다. Node.js 18 이상 런타임이 필요합니다.");
};

const buildFailure = (
  code: string,
  message: string,
  request: PipelineTriggerRequest
): PipelineResultFailure => ({
  ok: false,
  triggerSource: request.source,
  traceId: request.traceId ?? "pipeline-trace",
  contractVersion: request.contractVersion ?? DEFAULT_CONTRACT_VERSION,
  observedAt: new Date().toISOString(),
  error: { code, message },
  evidence: []
});

const isPipelineResult = (value: unknown): value is PipelineResult => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.ok === "boolean" &&
    typeof candidate.triggerSource === "string" &&
    typeof candidate.traceId === "string" &&
    typeof candidate.contractVersion === "string" &&
    typeof candidate.observedAt === "string" &&
    Array.isArray(candidate.evidence)
  );
};

export const runAnalysisPipelineToolDescriptor: PipelineToolDefinition["descriptor"] = {
  name: RUN_ANALYSIS_PIPELINE_TOOL_NAME,
  description: "Normalize -> analyze pipeline FastAPI HTTP bridge for the Pi pipeline milestone.",
  endpoint: "POST /pipeline/trigger"
};

export const createRunAnalysisPipelineTool = (
  options: CreateRunAnalysisPipelineToolOptions = {}
): PipelineToolDefinition => ({
  descriptor: runAnalysisPipelineToolDescriptor,
  async invoke(request: PipelineTriggerRequest): Promise<PipelineResult> {
    const endpointUrl = resolveEndpointUrl(options);
    const payload = {
      ...request,
      contractVersion: request.contractVersion ?? DEFAULT_CONTRACT_VERSION
    };

    let response: FetchResponseLike;
    try {
      response = await resolveFetch(options)(endpointUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      return buildFailure(
        "pipeline_http_error",
        error instanceof Error ? error.message : "저 공시리가 Pipeline HTTP 요청을 완료하지 못했습니다.",
        request
      );
    }

    const raw = (await response.text()).trim();

    if (!response.ok) {
      return buildFailure(
        "pipeline_http_error",
        `저 공시리가 Pipeline HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""} 응답을 받았습니다${raw ? `: ${raw}` : ""}`,
        request
      );
    }

    if (!raw) {
      return buildFailure(
        "pipeline_http_error",
        `저 공시리가 Pipeline HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}에서 빈 응답 본문을 받았습니다.`,
        request
      );
    }

    try {
      const parsed = JSON.parse(raw);
      if (isPipelineResult(parsed)) {
        return parsed;
      }

      return buildFailure(
        "pipeline_malformed_output",
        "저 공시리가 Pipeline HTTP 응답을 pipeline result contract로 해석하지 못했습니다.",
        request
      );
    } catch (error) {
      return buildFailure(
        "pipeline_malformed_output",
        error instanceof Error ? error.message : "저 공시리가 Pipeline HTTP JSON을 파싱하지 못했습니다.",
        request
      );
    }
  }
});

export const runAnalysisPipelineTool = createRunAnalysisPipelineTool();
