import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import {
  createRunAnalysisPipelineTool,
  runAnalysisPipelineToolDescriptor
} from "../dist/tools/runAnalysisPipeline.js";

const successEnvelope = (traceId = "pipeline-trace") => ({
  ok: true,
  triggerSource: "user",
  traceId,
  contractVersion: "v1",
  observedAt: "2026-05-20T12:00:00Z",
  result: {
    normalized_data_bundle: { company: { corp_name: "카카오" } },
    analysis_result: {
      risk_score: 2,
      risk_level: "caution",
      checklist: [],
      short_term_report: "short",
      long_term_report: "long",
      disclaimer: "disc",
      missing_evidence: []
    },
    preparation: { persistence: {}, notification: {} }
  },
  evidence: []
});

const makeJsonResponse = (body, init = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  statusText: init.statusText ?? "OK",
  async text() {
    return typeof body === "string" ? body : JSON.stringify(body);
  }
});

test("runAnalysisPipelineTool sends POST to configured FastAPI endpoint with JSON body", async () => {
  const calls = [];
  const tool = createRunAnalysisPipelineTool({
    apiUrl: "http://backend.test/pipeline/trigger",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return makeJsonResponse(successEnvelope("pipeline-trace"));
    }
  });

  const result = await tool.invoke({ source: "user", keyword: "카카오", traceId: "pipeline-trace" });

  assert.equal(result.ok, true);
  assert.equal(result.traceId, "pipeline-trace");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://backend.test/pipeline/trigger");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    source: "user",
    keyword: "카카오",
    traceId: "pipeline-trace",
    contractVersion: "v1"
  });
});

test("runAnalysisPipelineTool maps non-2xx HTTP to typed pipeline_http_error", async () => {
  const tool = createRunAnalysisPipelineTool({
    fetchImpl: async () => makeJsonResponse("backend unavailable", { ok: false, status: 503, statusText: "Service Unavailable" })
  });

  const result = await tool.invoke({ source: "cron", keyword: "카카오", traceId: "http-error" });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "pipeline_http_error");
  assert.match(result.error.message, /503/);
  assert.equal(result.traceId, "http-error");
});

test("runAnalysisPipelineTool maps malformed JSON to typed pipeline_malformed_output", async () => {
  const tool = createRunAnalysisPipelineTool({
    fetchImpl: async () => makeJsonResponse("not-json")
  });

  const result = await tool.invoke({ source: "system", keyword: "카카오", traceId: "bad-json" });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "pipeline_malformed_output");
  assert.equal(result.traceId, "bad-json");
});

test("runAnalysisPipelineTool descriptor advertises HTTP endpoint instead of Python subprocess", () => {
  assert.equal(runAnalysisPipelineToolDescriptor.name, "run_analysis_pipeline");
  assert.equal(runAnalysisPipelineToolDescriptor.endpoint, "POST /pipeline/trigger");
  assert.equal("canonicalCommand" in runAnalysisPipelineToolDescriptor, false);
});

test("pipeline CLI emits typed envelope through HTTP tool and preserves trace/source", () => {
  const result = spawnSync(
    "node",
    ["dist/cli/runPipelineTrigger.js", "--source", "cron", "--keyword", "카카오", "--trace-id", "cli-trace"],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      env: {
        ...process.env,
        GONGSIRI_PIPELINE_API_URL: "data:application/json," + encodeURIComponent(JSON.stringify({
          ...successEnvelope("cli-trace"),
          triggerSource: "cron"
        }))
      }
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.triggerSource, "cron");
  assert.equal(parsed.traceId, "cli-trace");
});
