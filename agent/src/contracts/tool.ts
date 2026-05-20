import type { FetchDisclosuresRequest } from "./request.js";
import type { ToolResult } from "./response.js";

export const FETCH_DISCLOSURES_TOOL_NAME = "fetch_disclosures";

export type ToolDescriptor = {
  name: typeof FETCH_DISCLOSURES_TOOL_NAME;
  description: string;
  canonicalCommand: "python -m backend.collector.cli.fetch_disclosures";
};

export type ToolDefinition = {
  descriptor: ToolDescriptor;
  invoke(request: FetchDisclosuresRequest): Promise<ToolResult>;
};

export const fetchDisclosuresToolDescriptor: ToolDescriptor = {
  name: FETCH_DISCLOSURES_TOOL_NAME,
  description: "Read-only disclosure fetch bridge for the Pi bootstrap milestone.",
  canonicalCommand: "python -m backend.collector.cli.fetch_disclosures"
};
