import test from "node:test";
import assert from "node:assert/strict";

import { buildPrompt, parseModeResult } from "../dist/server.js";

const baseRequest = {
  traceId: "mode-trace",
  contractVersion: "v1",
  normalizedDataBundle: { company: { corp_name: "카카오" } },
  analysisResult: {
    risk_score: 2,
    risk_level: "caution",
    checklist: [{ id: "business-purpose-change", title: "사업목적 전환 이력" }],
    short_term_report: "",
    long_term_report: "",
    disclaimer: "",
    missing_evidence: [],
  },
};

test("report mode buildPrompt returns SKILL.md content with JSON context", () => {
  const prompt = buildPrompt({ ...baseRequest, mode: "report" });

  // buildPrompt embeds SKILL.md body + JSON context block
  assert.equal(typeof prompt, "string");
  assert.ok(prompt.length > 0);
  // SKILL.md content is embedded
  assert.match(prompt, /공시리/);
  // JSON context block is appended
  assert.match(prompt, /JSON context/);
});

test("parseModeResult returns structured report payload without changing guard", () => {
  const parsed = parseModeResult(
    "report",
    JSON.stringify({
      shortTermMarkdown: "## 단기\nshort",
      longTermMarkdown: "## 장기\nlong",
      disclaimerMarkdown: "공시 기반 위험 점검입니다.",
      warnings: [],
    }),
    { ...baseRequest, mode: "report" },
  );

  assert.equal(parsed.data.analysisGuard.riskScore, 2);
  assert.equal(parsed.data.analysisGuard.riskLevel, "caution");
  assert.equal(parsed.data.report.shortTermMarkdown, "## 단기\nshort");
  assert.match(parsed.markdown, /## 단기/);
});

test("parseModeResult returns structured qa payload", () => {
  const parsed = parseModeResult(
    "qa",
    JSON.stringify({
      answerMarkdown: "저 공시리가 확인한 바로는 CB 공시를 함께 보셔야 합니다.",
      warnings: [],
    }),
    { ...baseRequest, mode: "qa", question: "질문" },
  );

  assert.equal(parsed.data.qa.answerMarkdown.includes("저 공시리가"), true);
  assert.equal(parsed.markdown, parsed.data.qa.answerMarkdown);
});

test("parseModeResult returns structured checklist explanation payload", () => {
  const parsed = parseModeResult(
    "checklist_explanation",
    JSON.stringify({
      summaryMarkdown: "체크리스트 설명 요약",
      items: [
        {
          id: "business-purpose-change",
          markdown:
            "저 공시리가 보기에는 사업목적 변경 공시를 확인해야 합니다.",
        },
      ],
      warnings: [],
    }),
    {
      ...baseRequest,
      mode: "checklist_explanation",
      checklistIds: ["business-purpose-change"],
    },
  );

  assert.equal(
    parsed.data.checklistExplanation.items[0].id,
    "business-purpose-change",
  );
  assert.match(
    parsed.data.checklistExplanation.items[0].markdown,
    /저 공시리가/,
  );
});

test("parseModeResult wraps plain-text qa response as answerMarkdown (free-form contract)", () => {
  // docs/07: "QA 출력: JSON 강제 없음 — 자연어 한국어 답변"
  // Solar/Pi가 plain text를 반환하면 answerMarkdown으로 wrapping해 처리한다.
  const parsed = parseModeResult("qa", "안녕하세요, 저 공시리입니다.", {
    ...baseRequest,
    mode: "qa",
    question: "안녕",
  });
  assert.equal(parsed.data.qa.answerMarkdown, "안녕하세요, 저 공시리입니다.");
  assert.equal(parsed.markdown, "안녕하세요, 저 공시리입니다.");
});

test("parseModeResult rejects malformed non-json output for non-qa modes", () => {
  assert.throws(
    () =>
      parseModeResult("report", "not-json", {
        ...baseRequest,
        mode: "report",
      }),
    /JSON/,
  );
});
