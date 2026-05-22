import { fileURLToPath } from "node:url";
import { buildPrompt } from "./agentPrompt.js";
import { parseModeResult } from "./agentModeParser.js";
import { createAgentHttpServer, startAgentHttpServer } from "./agentHttpRuntime.js";

export { buildPrompt, createAgentHttpServer, parseModeResult, startAgentHttpServer };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startAgentHttpServer();
}
