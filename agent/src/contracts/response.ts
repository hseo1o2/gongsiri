import type { ContractVersion } from "./request.js";
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
