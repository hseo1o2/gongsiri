import type { AnalysisResultPayload } from "./pipeline.js";
import type { ContractVersion } from "./request.js";

export type AgentServiceMode = "report" | "qa" | "checklist_explanation";
export type AgentServiceEvidence = Record<string, unknown>;
export type AgentChecklistExplanationItem = {
  id: string;
  title?: string;
  markdown: string;
};
export type AgentAnalysisGuard = {
  riskScore: number;
  riskLevel: AnalysisResultPayload["risk_level"];
  checklistIds: string[];
};

type AgentRequestBase = {
  traceId?: string;
  contractVersion?: ContractVersion;
  source?: "user" | "system" | "cron";
  corpCode?: string;
  corpName?: string;
  context?: unknown;
  bundle?: Record<string, unknown>;
  normalizedDataBundle?: Record<string, unknown>;
  analysisResult?: AnalysisResultPayload;
  preparation?: Record<string, unknown>;
  evidence?: AgentServiceEvidence[];
};

export type AgentReportRequest = AgentRequestBase & {
  mode?: "report";
  prompt?: string;
};

export interface AgentQaPriorTurn {
  question: string;
  answer: string;
  evidence?: unknown[];
  askedAt: string; // ISO-8601
}

export type AgentQaRequest = AgentRequestBase & {
  mode?: "qa";
  question: string;
  conversationKey?: string;
  priorTurns?: AgentQaPriorTurn[];
};

export type AgentChecklistExplanationRequest = AgentRequestBase & {
  mode?: "checklist_explanation";
  checklistIds?: string[];
};

export type AgentServiceRequest =
  | AgentReportRequest
  | AgentQaRequest
  | AgentChecklistExplanationRequest;

export type AgentServiceSuccess = {
  ok: true;
  mode: AgentServiceMode;
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  markdown: string;
  text: string;
  warnings: string[];
  data:
    | {
        report: {
          shortTermMarkdown: string;
          longTermMarkdown: string;
          disclaimerMarkdown: string;
        };
        analysisGuard: AgentAnalysisGuard;
      }
    | {
        qa: {
          answerMarkdown: string;
        };
        analysisGuard: AgentAnalysisGuard;
      }
    | {
        checklistExplanation: {
          summaryMarkdown: string;
          items: AgentChecklistExplanationItem[];
        };
        analysisGuard: AgentAnalysisGuard;
      };
  evidence: AgentServiceEvidence[];
};

export type AgentServiceFailure = {
  ok: false;
  mode: AgentServiceMode;
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  markdown: "";
  text: "";
  warnings: [];
  error: {
    code:
      | "invalid_request"
      | "missing_env"
      | "method_not_allowed"
      | "not_found"
      | "pi_agent_error"
      | "pi_agent_malformed_output";
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
  warmSessions?: Array<{
    convKeyHash: string;
    turnCount: number;
    lastUsedAt: number;
    sessionStartedAt: number;
  }>;
  warmSessionsSize?: number;
};
