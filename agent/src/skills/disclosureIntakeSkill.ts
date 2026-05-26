import type {
  FetchDisclosuresRequest,
  PromptRequest,
} from "../contracts/request.js";
import { FETCH_DISCLOSURES_TOOL_NAME } from "../contracts/tool.js";

export const DISCLOSURE_INTAKE_SKILL = "disclosure-intake-skill";

export type SkillSelection = {
  skill: typeof DISCLOSURE_INTAKE_SKILL;
  tool: typeof FETCH_DISCLOSURES_TOOL_NAME;
};

export const selectDisclosureIntakeSkill = (): SkillSelection => ({
  skill: DISCLOSURE_INTAKE_SKILL,
  tool: FETCH_DISCLOSURES_TOOL_NAME,
});

const COMMON_DISCLOSURE_PHRASES = [
  "최근",
  "최신",
  "공시",
  "조회",
  "보여줘",
  "보여주세요",
  "가져와",
  "가져와줘",
  "찾아줘",
  "확인해줘",
  "확인",
  "내역",
  "목록",
  "정보",
  "관련",
  "좀",
  "를",
  "을",
  "의",
];

const extractCorpCode = (text: string): string | null => {
  const match = text.match(/\b\d{8}\b/);
  return match ? match[0] : null;
};

const extractKeyword = (text: string): string | null => {
  const normalized = COMMON_DISCLOSURE_PHRASES.reduce(
    (current, phrase) => current.replaceAll(phrase, " "),
    text.trim(),
  )
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  return normalized.split(" ")[0] ?? null;
};

export const buildDisclosureRequest = (
  prompt: PromptRequest,
): FetchDisclosuresRequest => {
  const corpCode = extractCorpCode(prompt.text);

  if (corpCode) {
    return {
      corpCode,
      traceId: prompt.traceId,
      contractVersion: prompt.contractVersion ?? "v2",
    };
  }

  const keyword = extractKeyword(prompt.text);

  if (!keyword) {
    throw new Error(
      "공시 조회를 위한 keyword 또는 corpCode를 추출할 수 없습니다.",
    );
  }

  return {
    keyword,
    traceId: prompt.traceId,
    contractVersion: prompt.contractVersion ?? "v2",
  };
};
