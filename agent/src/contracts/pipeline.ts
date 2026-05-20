import type { ContractVersion, TriggerMetadata, TriggerSource } from "./request.js";

export type PipelineTriggerRequest = {
  source: TriggerSource;
  keyword?: string;
  corpCode?: string;
  traceId?: string;
  contractVersion?: ContractVersion;
  metadata?: TriggerMetadata;
};

export type AnalysisChecklistItem = {
  id: string;
  title: string;
  status: "pass" | "fail" | "unknown";
  score: number;
  reason: string;
  evidence: string[];
};

export type AnalysisResultPayload = {
  risk_score: number;
  risk_level: "normal" | "caution" | "high";
  checklist: AnalysisChecklistItem[];
  short_term_report: string;
  long_term_report: string;
  disclaimer: string;
  missing_evidence: string[];
};

export type PipelineResultSuccess = {
  ok: true;
  triggerSource: TriggerSource;
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  result: {
    normalized_data_bundle: Record<string, unknown>;
    analysis_result: AnalysisResultPayload;
    preparation: {
      persistence: Record<string, unknown>;
      notification: Record<string, unknown>;
    };
  };
  evidence: Array<Record<string, unknown>>;
};

export type PipelineResultFailure = {
  ok: false;
  triggerSource: TriggerSource;
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  error: {
    code: string;
    message: string;
  };
  evidence: Array<Record<string, unknown>>;
};

export type PipelineResult = PipelineResultSuccess | PipelineResultFailure;

export const RUN_ANALYSIS_PIPELINE_TOOL_NAME = "run_analysis_pipeline";
