import type { PromptRequest } from "../contracts/request.js";
import type { ToolDefinition } from "../contracts/tool.js";
import type { AgentResponse } from "../contracts/response.js";
import {
  buildDisclosureRequest,
  DISCLOSURE_INTAKE_SKILL,
  selectDisclosureIntakeSkill,
} from "../skills/disclosureIntakeSkill.js";

export class PiDisclosureAgent {
  readonly name = "PiDisclosureAgent";

  constructor(private readonly tool: ToolDefinition) {}

  canHandle(prompt: PromptRequest): boolean {
    const normalized = prompt.text.toLowerCase();
    return ["공시", "disclosure", "dart"].some((keyword) =>
      normalized.includes(keyword),
    );
  }

  async run(prompt: PromptRequest): Promise<AgentResponse> {
    const selection = selectDisclosureIntakeSkill();
    const traceId = prompt.traceId ?? "pi-bootstrap-trace";
    const contractVersion = prompt.contractVersion ?? "v2";

    const result = await this.tool
      .invoke(buildDisclosureRequest({ ...prompt, traceId, contractVersion }))
      .catch((error: unknown) => ({
        ok: false as const,
        traceId,
        contractVersion,
        observedAt: new Date().toISOString(),
        error: {
          code: "invalid_request" as const,
          message:
            error instanceof Error
              ? error.message
              : "알 수 없는 요청 오류가 발생했습니다.",
        },
        evidence: [] as [],
      }));

    return {
      agent: this.name,
      skill: DISCLOSURE_INTAKE_SKILL,
      tool: selection.tool,
      traceId,
      contractVersion,
      result,
    };
  }
}
