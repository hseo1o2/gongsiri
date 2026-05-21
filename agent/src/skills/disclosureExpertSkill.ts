import { solarChatTool, type SolarChatTool } from "../tools/chatWithSolar.js";
import type { ContractVersion } from "../contracts/request.js";

import type { SolarChatResult, SolarChatRequest, SolarChatSuccess } from "../contracts/chat.js";

export const DISCLOSURE_EXPERT_SKILL = "disclosure-expert-skill";

type AnalysisResultBundle = {
  risk_score: number;
  risk_level: "normal" | "caution" | "high";
  checklist: unknown[];
};

export type DisclosureExpertInput = {
  traceId: string;
  contractVersion?: ContractVersion;
  normalizedDataBundle: Record<string, unknown>;
  analysisResult: AnalysisResultBundle;
};

export type DisclosureExpertPrompt = {
  systemPrompt: string;
  userPrompt: string;
};

export type DisclosureExpertSuccess = {
  ok: true;
  tool: "chat_with_solar";
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  solar: SolarChatSuccess;
};

export type DisclosureExpertFailure = {
  ok: false;
  tool: "chat_with_solar";
  traceId: string;
  contractVersion: ContractVersion;
  observedAt: string;
  error: {
    code: "disclosure_expert_malformed_output" | "disclosure_expert_solar_failed";
    message: string;
  };
};

export type DisclosureExpertResult = DisclosureExpertSuccess | DisclosureExpertFailure;

type DisclosureExpertDependencies = {
  solarTool?: SolarChatTool;
};

type DisclosureExpertSkill = {
  descriptor: {
    name: typeof DISCLOSURE_EXPERT_SKILL;
  };
  buildPrompt(input: DisclosureExpertInput): DisclosureExpertPrompt;
  invoke(request: DisclosureExpertInput): Promise<DisclosureExpertResult>;
};

const DEFAULT_CONTRACT_VERSION: ContractVersion = "v1";

const resolvePromptMetadata = (input: DisclosureExpertInput): string => {
  const corpName =
    (input.normalizedDataBundle?.company && (input.normalizedDataBundle.company as Record<string, unknown>).corp_name) ||
    "미지정 기업";

  return `
공시 대상 기업: ${corpName}
리스크 점수: ${input.analysisResult.risk_score}
리스크 레벨: ${input.analysisResult.risk_level}
`;
};

export const buildDisclosureExpertPrompt = (input: DisclosureExpertInput): DisclosureExpertPrompt => {
  const metadata = resolvePromptMetadata(input);
  const userPrompt = `
${metadata}
최근 공시 데이터:
${JSON.stringify(input.normalizedDataBundle)}
`; 

  const systemPrompt = [
    "당신은 한국 자본시장 공시 분석 공시 전문가입니다.",
    "STEP1: 정량 위험도/리스크 포인트를 먼저 요약하고 근거를 제시한다.",
    "STEP2: 공시 항목별로 잠재적인 투자 의사결정 영향도를 제시한다.",
    "STEP3: 사용자 질문이 있다면 정확한 숫자 근거 기반으로 간단명료하게 한국어로 답한다.",
    "출력은 반드시 JSON 문자열이어야 하며, summary(요약), riskLevel(최종 리스크), actionItems(권고 항목) 키를 포함한다.",
    "질문 없음: 최신 공시 기반으로 핵심 시사점을 bullet보다 한 문단 중심으로 정리한다."
  ].join("\n");

  return {
    systemPrompt,
    userPrompt: userPrompt.trim()
  };
};

const buildFailure = (
  request: DisclosureExpertInput,
  code: DisclosureExpertFailure["error"]["code"],
  message: string,
  contractVersion: ContractVersion
): DisclosureExpertFailure => ({
  ok: false,
  tool: "chat_with_solar",
  traceId: request.traceId,
  contractVersion,
  observedAt: new Date().toISOString(),
  error: {
    code,
    message
  }
});

export const createDisclosureExpertSkill = (options: DisclosureExpertDependencies = {}): DisclosureExpertSkill => ({
  descriptor: {
    name: DISCLOSURE_EXPERT_SKILL
  },
  buildPrompt: (request) => buildDisclosureExpertPrompt(request),
  async invoke(request: DisclosureExpertInput): Promise<DisclosureExpertResult> {
    const tool = options.solarTool ?? solarChatTool;
    const contractVersion: ContractVersion = request.contractVersion ?? DEFAULT_CONTRACT_VERSION;
    const prompt = buildDisclosureExpertPrompt(request);

    const solarRequest: SolarChatRequest = {
      traceId: request.traceId,
      contractVersion,
      systemPrompt: prompt.systemPrompt,
      prompt: prompt.userPrompt
    };

    const result = await tool.invoke(solarRequest);

    if (!result.ok) {
      return buildFailure(request, "disclosure_expert_solar_failed", result.error.message, contractVersion);
    }

    try {
      JSON.parse(result.text);
    } catch {
      return buildFailure(request, "disclosure_expert_malformed_output", "chat_with_solar 응답이 JSON 형식이 아닙니다.", contractVersion);
    }

    return {
      ok: true,
      tool: "chat_with_solar",
      traceId: result.traceId,
      contractVersion,
      observedAt: result.observedAt,
      solar: result
    };
  }
});
