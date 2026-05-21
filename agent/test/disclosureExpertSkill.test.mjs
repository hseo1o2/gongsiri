import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDisclosureExpertPrompt,
  createDisclosureExpertSkill
} from "../dist/skills/disclosureExpertSkill.js";

test("disclosure expert skill builds an agent-owned STEP-style system prompt", () => {
  const prompt = buildDisclosureExpertPrompt({
    traceId: "expert-prompt",
    normalizedDataBundle: { company: { corp_name: "카카오" }, disclosures: [] },
    analysisResult: { risk_score: 2, risk_level: "caution", checklist: [] }
  });

  assert.match(prompt.systemPrompt, /공시 전문가/);
  assert.match(prompt.systemPrompt, /STEP1|STEP2|리스크/);
  assert.match(prompt.userPrompt, /카카오/);
});

test("disclosure expert skill invokes chat_with_solar through injected seam", async () => {
  const calls = [];
  const skill = createDisclosureExpertSkill({
    solarTool: {
      descriptor: { name: "chat_with_solar" },
      invoke: async (request) => {
        calls.push(request);
        return {
          ok: true,
          traceId: request.traceId,
          contractVersion: request.contractVersion,
          observedAt: "2026-05-21T00:00:00Z",
          model: "stub-solar",
          text: JSON.stringify({ summary: "agent-owned reasoning", riskLevel: "caution" })
        };
      }
    }
  });

  const result = await skill.invoke({
    traceId: "expert-trace",
    contractVersion: "v1",
    normalizedDataBundle: { company: { corp_name: "카카오" }, disclosures: [] },
    analysisResult: { risk_score: 2, risk_level: "caution", checklist: [] }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].traceId, "expert-trace");
  assert.equal(calls[0].contractVersion, "v1");
  assert.match(calls[0].systemPrompt, /공시 전문가/);
  assert.match(calls[0].prompt, /카카오/);
  assert.equal(result.ok, true);
  assert.equal(result.tool, "chat_with_solar");
  assert.equal(result.solar.text.includes("agent-owned reasoning"), true);
});

test("disclosure expert skill returns machine-readable failure for invalid Solar output", async () => {
  const skill = createDisclosureExpertSkill({
    solarTool: {
      descriptor: { name: "chat_with_solar" },
      invoke: async (request) => ({
        ok: true,
        traceId: request.traceId,
        contractVersion: request.contractVersion,
        observedAt: "2026-05-21T00:00:00Z",
        model: "stub-solar",
        text: "not-json"
      })
    }
  });

  const result = await skill.invoke({
    traceId: "expert-bad-json",
    contractVersion: "v1",
    normalizedDataBundle: { company: { corp_name: "카카오" }, disclosures: [] },
    analysisResult: { risk_score: 2, risk_level: "caution", checklist: [] }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "disclosure_expert_malformed_output");
  assert.equal(result.traceId, "expert-bad-json");
});
