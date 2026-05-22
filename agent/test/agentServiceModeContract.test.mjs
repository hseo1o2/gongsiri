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
    missing_evidence: []
  }
};

test("report mode prompt requires JSON contract and 공시리 tone", () => {
  const prompt = buildPrompt({ ...baseRequest, mode: "report" });

  assert.match(prompt, /공시리/);
  assert.match(prompt, /JSON만 출력/);
  assert.match(prompt, /shortTermMarkdown/);
});

test("parseModeResult returns structured report payload without changing guard", () => {
  const parsed = parseModeResult(
    "report",
    JSON.stringify({
      shortTermMarkdown: "## 단기\nshort",
      longTermMarkdown: "## 장기\nlong",
      disclaimerMarkdown: "공시 기반 위험 점검입니다.",
      warnings: []
    }),
    { ...baseRequest, mode: "report" }
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
      warnings: []
    }),
    { ...baseRequest, mode: "qa", question: "질문" }
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
          markdown: "저 공시리가 보기에는 사업목적 변경 공시를 확인해야 합니다."
        }
      ],
      warnings: []
    }),
    {
      ...baseRequest,
      mode: "checklist_explanation",
      checklistIds: ["business-purpose-change"]
    }
  );

  assert.equal(parsed.data.checklistExplanation.items[0].id, "business-purpose-change");
  assert.match(parsed.data.checklistExplanation.items[0].markdown, /저 공시리가/);
});

test("parseModeResult rejects malformed non-json mode output", () => {
  assert.throws(
    () => parseModeResult("qa", "not-json", { ...baseRequest, mode: "qa", question: "질문" }),
    /JSON/
  );
});
