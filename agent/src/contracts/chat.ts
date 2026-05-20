import type { ContractVersion } from "./request.js";

export type SolarChatRequest = {
  prompt: string;
  systemPrompt?: string;
  traceId?: string;
  contractVersion?: ContractVersion;
};

export type SolarChatSuccess = {
  ok: true;
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  model: string;
  text: string;
};

export type SolarChatFailure = {
  ok: false;
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  error: {
    code: "missing_env" | "solar_api_error" | "solar_malformed_output";
    message: string;
  };
};

export type SolarChatResult = SolarChatSuccess | SolarChatFailure;

export const SOLAR_CHAT_TOOL_NAME = "chat_with_solar";
