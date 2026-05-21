import type { ContractVersion } from "./request.js";

export type AgentServiceMode = "report" | "qa";
export type AgentServiceEvidence = Record<string, unknown>;

export type AgentReportRequest = {
  mode?: "report";
  traceId?: string;
  contractVersion?: ContractVersion;
  corpCode?: string;
  corpName?: string;
  prompt?: string;
  context?: unknown;
  bundle?: Record<string, unknown>;
  normalizedDataBundle?: Record<string, unknown>;
  analysisResult?: Record<string, unknown>;
  preparation?: Record<string, unknown>;
  evidence?: AgentServiceEvidence[];
};

export type AgentQaRequest = {
  mode?: "qa";
  traceId?: string;
  contractVersion?: ContractVersion;
  corpCode?: string;
  corpName?: string;
  question: string;
  context?: unknown;
  bundle?: Record<string, unknown>;
  normalizedDataBundle?: Record<string, unknown>;
  analysisResult?: Record<string, unknown>;
  preparation?: Record<string, unknown>;
  evidence?: AgentServiceEvidence[];
};

export type AgentServiceRequest = AgentReportRequest | AgentQaRequest;

export type AgentServiceSuccess = {
  ok: true;
  mode: AgentServiceMode;
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  text: string;
  evidence: AgentServiceEvidence[];
};

export type AgentServiceFailure = {
  ok: false;
  mode: AgentServiceMode;
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  text: "";
  error: {
    code:
      | "invalid_request"
      | "missing_env"
      | "method_not_allowed"
      | "not_found"
      | "pi_agent_error";
    message: string;
  };
  evidence: AgentServiceEvidence[];
};

export type AgentServiceResponse = AgentServiceSuccess | AgentServiceFailure;
export type AgentServiceResult = AgentServiceResponse;

export type AgentHealthResponse = {
  ok: true;
  service: "gongsiri-pi-agent";
  contractVersion: ContractVersion;
  observedAt: string;
};
