export type ToolErrorCode =
  | "invalid_request"
  | "corp_code_unresolved"
  | "missing_env"
  | "dart_api_error"
  | "bridge_process_failed"
  | "bridge_malformed_output";

export type ToolError = {
  code: ToolErrorCode;
  message: string;
};
