/**
 * agentPrompt.ts 가 각 모드별 SKILL.md 본문을 실제로 읽어
 * 프롬프트에 포함하는지 검증한다.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildPrompt } from "../dist/agentPrompt.js";

const baseRequest = {
  traceId: "skill-md-trace",
  contractVersion: "v1",
  normalizedDataBundle: { company: { corp_name: "삼성전자" } },
  analysisResult: {
    risk_score: 3,
    risk_level: "caution",
    checklist: [{ id: "hot-theme", title: "핫테마 편승" }],
    short_term_report: "",
    long_term_report: "",
    disclaimer: "",
    missing_evidence: [],
  },
};

// report 모드 — SKILL.md 지시·출력계약 포함 확인
test("report buildPrompt includes SKILL.md role/tone instruction", () => {
  const prompt = buildPrompt({ ...baseRequest, mode: "report" });
  // SKILL.md 역할 및 톤 섹션
  assert.match(prompt, /공시리/);
  assert.match(prompt, /1인칭/);
});

test("report buildPrompt includes SKILL.md output contract fields", () => {
  const prompt = buildPrompt({ ...baseRequest, mode: "report" });
  assert.match(prompt, /shortTermMarkdown/);
  assert.match(prompt, /longTermMarkdown/);
  assert.match(prompt, /disclaimerMarkdown/);
});

test("report buildPrompt includes SKILL.md JSON-only rule", () => {
  const prompt = buildPrompt({ ...baseRequest, mode: "report" });
  assert.match(prompt, /JSON만 출력/);
});

test("report buildPrompt includes disclaimer instruction from SKILL.md", () => {
  const prompt = buildPrompt({ ...baseRequest, mode: "report" });
  // SKILL.md에 명시된 disclaimer 지시
  assert.match(prompt, /disclaimerMarkdown/);
  assert.match(prompt, /투자 판단/);
});

test("report buildPrompt includes 6-item checklist section from SKILL.md", () => {
  const prompt = buildPrompt({ ...baseRequest, mode: "report" });
  assert.match(prompt, /사업목적 전환/);
  assert.match(prompt, /핫테마/);
  assert.match(prompt, /CB·감자/);
});

test("report buildPrompt appends optional extra prompt", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "report",
    prompt: "한 줄 요약 추가",
  });
  assert.match(prompt, /추가 작성 지시: 한 줄 요약 추가/);
});

test("report buildPrompt without extra prompt has no '추가 작성 지시' line", () => {
  const prompt = buildPrompt({ ...baseRequest, mode: "report" });
  assert.doesNotMatch(prompt, /추가 작성 지시/);
});

// qa 모드 — SKILL.md 지시·출력계약 포함 확인
test("qa buildPrompt includes SKILL.md role/tone instruction", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "qa",
    question: "CB 공시가 있나요?",
  });
  assert.match(prompt, /공시리/);
  assert.match(prompt, /1인칭/);
});

test("qa buildPrompt includes SKILL.md output contract", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "qa",
    question: "CB 공시가 있나요?",
  });
  assert.match(prompt, /answerMarkdown/);
});

test("qa buildPrompt includes JSON-only rule from SKILL.md", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "qa",
    question: "CB 공시가 있나요?",
  });
  assert.match(prompt, /JSON만 출력/);
});

test("qa buildPrompt appends question as dynamic part", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "qa",
    question: "CB 공시가 있나요?",
  });
  assert.match(prompt, /질문: CB 공시가 있나요\?/);
});

// checklist_explanation 모드 — SKILL.md 지시·출력계약 포함 확인
test("checklist_explanation buildPrompt includes SKILL.md role/tone instruction", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "checklist_explanation",
    checklistIds: ["hot-theme"],
  });
  assert.match(prompt, /공시리/);
});

test("checklist_explanation buildPrompt includes SKILL.md output contract", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "checklist_explanation",
    checklistIds: ["hot-theme"],
  });
  assert.match(prompt, /summaryMarkdown/);
  assert.match(prompt, /\"id\"/);
});

test("checklist_explanation buildPrompt includes JSON-only rule from SKILL.md", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "checklist_explanation",
    checklistIds: ["hot-theme"],
  });
  assert.match(prompt, /JSON만 출력/);
});

test("checklist_explanation buildPrompt includes requested ids as dynamic part", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "checklist_explanation",
    checklistIds: ["hot-theme", "cb-reduction"],
  });
  assert.match(prompt, /설명 대상 checklist ids: hot-theme, cb-reduction/);
});

test("checklist_explanation buildPrompt uses fallback when no ids provided", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "checklist_explanation",
    checklistIds: [],
  });
  assert.match(prompt, /analysisResult\.checklist 전체/);
});

test("checklist_explanation buildPrompt includes items-only rule from SKILL.md", () => {
  const prompt = buildPrompt({
    ...baseRequest,
    mode: "checklist_explanation",
    checklistIds: ["hot-theme"],
  });
  // SKILL.md: "items에는 요청된 checklist id만 포함하세요"
  assert.match(prompt, /요청된 checklist id만/);
});

// 공통 — JSON context 직렬화 포함 확인
test("all modes include serialized JSON context", () => {
  for (const mode of ["report", "qa", "checklist_explanation"]) {
    const req =
      mode === "qa"
        ? { ...baseRequest, mode, question: "질문" }
        : { ...baseRequest, mode, checklistIds: [] };
    const prompt = buildPrompt(req);
    // contextFrom 결과의 키가 포함되는지
    assert.match(
      prompt,
      /삼성전자/,
      `${mode} mode should contain corp name in context`,
    );
  }
});
