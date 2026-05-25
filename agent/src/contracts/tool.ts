import type { FetchDisclosuresRequest } from "./request.js";
import type { ToolResult } from "./response.js";

export const FETCH_DISCLOSURES_TOOL_NAME = "fetch_disclosures";

export type ToolDescriptor = {
  name: typeof FETCH_DISCLOSURES_TOOL_NAME;
  description: string;
  canonicalCommand: "POST /internal/disclosures";
};

export type ToolDefinition = {
  descriptor: ToolDescriptor;
  invoke(request: FetchDisclosuresRequest): Promise<ToolResult>;
};

export const fetchDisclosuresToolDescriptor: ToolDescriptor = {
  name: FETCH_DISCLOSURES_TOOL_NAME,
  description:
    "Read-only disclosure fetch bridge backed by backend /internal/disclosures.",
  canonicalCommand: "POST /internal/disclosures",
};
