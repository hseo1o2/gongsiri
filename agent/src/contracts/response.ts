import type { PipelineResult } from "./pipeline.js";
import type { ContractVersion, TriggerSource } from "./request.js";
import type { ToolEvidence } from "./evidence.js";
import type { ToolError } from "./error.js";

export type CompanyInfo = {
  corp_name: string;
  stock_code: string;
  corp_code?: string;
  market?: string;
};

export type DisclosureItem = {
  rcept_no: string;
  report_nm: string;
  rcept_dt: string;
  parsed_text?: string | null;
  url?: string | null;
  category?: string | null;
};

export type ToolResultSuccess = {
  ok: true;
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  data: {
    corpCode: string;
    company: CompanyInfo | null;
    disclosures: DisclosureItem[];
  };
  evidence: ToolEvidence[];
};

export type ToolResultFailure = {
  ok: false;
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  error: ToolError;
  evidence: [];
};

export type ToolResult = ToolResultSuccess | ToolResultFailure;

export type AgentResponse = {
  agent: "PiDisclosureAgent";
  skill: "disclosure-intake-skill";
  tool: "fetch_disclosures";
  traceId: string;
  contractVersion: ContractVersion;
  result: ToolResult;
};

export type TriggerCheckpoint = {
  checkpointPath: string;
  previousLastSeen: string | null;
  currentLastSeen: string | null;
};

type TriggerResultShared = {
  triggerSource: TriggerSource;
  traceId: string;
  contractVersion: ContractVersion;
  hasNewDisclosure: boolean;
  newDisclosureCount: number;
  newDisclosureIds: string[];
  checkpoint: TriggerCheckpoint;
};

export type TriggeredDisclosureSuccess = TriggerResultShared & {
  ok: true;
  result: ToolResultSuccess;
  pipelineResult?: PipelineResult;
};

export type TriggeredDisclosureFailure = TriggerResultShared & {
  ok: false;
  result: ToolResultFailure;
};

export type TriggeredDisclosureResult =
  | TriggeredDisclosureSuccess
  | TriggeredDisclosureFailure;
