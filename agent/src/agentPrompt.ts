import type {
  AgentChecklistExplanationRequest,
  AgentQaRequest,
  AgentReportRequest,
  AgentServiceRequest,
} from "./contracts/agentService.js";

const GONGSIRI_TONE_INSTRUCTION =
  "반드시 공시리 1인칭으로 말하세요. 사용자에게 직접 보이는 모든 문장은 '저 공시리가...' 또는 '공시리가...' 톤을 유지하고, 자신을 일반 agent가 아니라 '공시리'라고 부르세요.";

const reportOutputContract = [
  "{",
  '  "shortTermMarkdown": "string",',
  '  "longTermMarkdown": "string",',
  '  "disclaimerMarkdown": "string",',
  '  "warnings": ["string"]',
  "}"
].join("\n");

const qaOutputContract = [
  "{",
  '  "answerMarkdown": "string",',
  '  "warnings": ["string"]',
  "}"
].join("\n");

const checklistOutputContract = [
  "{",
  '  "summaryMarkdown": "string",',
  '  "items": [{"id": "checklist-id", "markdown": "string"}],',
  '  "warnings": ["string"]',
  "}"
].join("\n");

function contextFrom(request: AgentServiceRequest): unknown {
  if ("context" in request && request.context !== undefined) {
    return request.context;
  }
  if (request.bundle || request.normalizedDataBundle || request.analysisResult || request.preparation) {
    return {
      corpCode: request.corpCode,
      corpName: request.corpName,
      normalizedDataBundle: request.normalizedDataBundle ?? request.bundle,
      analysisResult: request.analysisResult,
      preparation: request.preparation
    };
  }
  return undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export const buildPrompt = (request: AgentServiceRequest): string => {
  const context = JSON.stringify(contextFrom(request), null, 2);

  if (request.mode === "qa") {
    return [
      "아래 backend-generated JSON context만 근거로 사용자의 질문에 답하세요.",
      GONGSIRI_TONE_INSTRUCTION,
      "반드시 JSON만 출력하세요.",
      `출력 계약:\n${qaOutputContract}`,
      "answerMarkdown에는 핵심 판단, 공시/주식 정보 근거, 투자 조언이 아니라는 고지를 Markdown으로 포함하세요.",
      "근거가 부족하면 부족하다고 명시하고 warnings에 부족한 점을 넣으세요.",
      `질문: ${(request as AgentQaRequest).question}`,
      "JSON context:",
      context
    ].join("\n\n");
  }

  if (request.mode === "checklist_explanation") {
    const checklistIds = stringArray((request as AgentChecklistExplanationRequest).checklistIds);
    return [
      "아래 backend-generated JSON context만 근거로 6개 체크리스트 설명을 생성하세요.",
      GONGSIRI_TONE_INSTRUCTION,
      "반드시 JSON만 출력하세요.",
      `출력 계약:\n${checklistOutputContract}`,
      "items에는 요청된 checklist id만 포함하고, 각 markdown은 근거 중심의 짧은 Markdown 설명이어야 합니다.",
      checklistIds.length > 0
        ? `설명 대상 checklist ids: ${checklistIds.join(", ")}`
        : "설명 대상 checklist ids: analysisResult.checklist 전체",
      "JSON context:",
      context
    ].join("\n\n");
  }

  return [
    "아래 backend-generated JSON context만 근거로 공시리 리포트 본문을 생성하세요.",
    GONGSIRI_TONE_INSTRUCTION,
    "반드시 JSON만 출력하세요.",
    `출력 계약:\n${reportOutputContract}`,
    "shortTermMarkdown과 longTermMarkdown은 Markdown으로 작성하세요.",
    "disclaimerMarkdown에는 공시 기반 위험 점검이며 투자 판단을 대신하지 않는다는 고지를 포함하세요.",
    "analysisResult의 risk_score/risk_level/checklist가 있으면 반영하되 확정적 작전주 판정은 피하세요.",
    (request as AgentReportRequest).prompt
      ? `추가 작성 지시: ${(request as AgentReportRequest).prompt}`
      : "",
    "JSON context:",
    context
  ]
    .filter(Boolean)
    .join("\n\n");
};
