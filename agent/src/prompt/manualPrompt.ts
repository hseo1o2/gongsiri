import type { PromptRequest } from "../contracts/request.js";

export const normalizeManualPrompt = (text: string): PromptRequest => ({
  text: text.trim(),
  contractVersion: "v2",
});
