import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

import {
  createRunAnalysisPipelineTool,
  runAnalysisPipelineToolDescriptor
} from "../dist/tools/runAnalysisPipeline.js";

const makeJsonResponse = (body, init = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  statusText: init.statusText ?? "OK",
  text: async () => (typeof body === "string" ? body : JSON.stringify(body))
});

const successEnvelope = (overrides = {}) => ({
  ok: true,
  triggerSource: "user",
  traceId: "pipeline-trace",
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
  evidence: [],
  ...overrides
});

test("runAnalysisPipelineTool posts request to FastAPI HTTP endpoint", async () => {
  const calls = [];
  const tool = createRunAnalysisPipelineTool({
    endpointUrl: "http://127.0.0.1:8765/analysis/pipeline",
    fetchImpl: async (input, init) => {
      calls.push({ input, init });
      return makeJsonResponse(successEnvelope());
    }
  });

  const result = await tool.invoke({ source: "user", keyword: "카카오", traceId: "pipeline-trace" });

  assert.equal(result.ok, true);
  assert.equal(result.traceId, "pipeline-trace");
  assert.equal(result.result.analysis_result.risk_level, "caution");
  assert.equal(calls[0].input, "http://127.0.0.1:8765/analysis/pipeline");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    source: "user",
    keyword: "카카오",
    traceId: "pipeline-trace",
    contractVersion: "v1"
  });
});

test("runAnalysisPipelineTool returns typed failure for HTTP transport errors", async () => {
  const tool = createRunAnalysisPipelineTool({
    fetchImpl: async () => {
      throw new Error("connection refused");
    }
  });

  const result = await tool.invoke({ source: "cron", keyword: "카카오" });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "pipeline_http_error");
  assert.match(result.error.message, /connection refused/);
});

test("runAnalysisPipelineTool maps malformed HTTP output to typed failure", async () => {
  const tool = createRunAnalysisPipelineTool({
    fetchImpl: async () => makeJsonResponse("not-json")
  });

  const result = await tool.invoke({ source: "cron", keyword: "카카오" });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "pipeline_malformed_output");
});

test("runAnalysisPipelineTool preserves machine-readable failure envelopes from FastAPI", async () => {
  const tool = createRunAnalysisPipelineTool({
    fetchImpl: async () =>
      makeJsonResponse(
        {
          ok: false,
          triggerSource: "cron",
          traceId: "bad-request-trace",
          contractVersion: "v1",
          observedAt: "2026-05-20T12:00:00Z",
          error: { code: "invalid_request", message: "keyword 또는 corpCode 중 하나는 반드시 필요합니다." },
          evidence: []
        },
        { ok: false, status: 400, statusText: "Bad Request" }
      )
  });

  const result = await tool.invoke({ source: "cron", traceId: "bad-request-trace" });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_request");
  assert.equal(result.triggerSource, "cron");
});

test("pipeline CLI emits typed envelope through FastAPI HTTP endpoint", async () => {
  const receivedBodies = [];
  const server = createServer(async (req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/analysis/pipeline");

    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    receivedBodies.push(JSON.parse(body));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(successEnvelope({ triggerSource: "cron", traceId: "cli-trace" })));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  const endpointUrl = `http://127.0.0.1:${address.port}/analysis/pipeline`;

  try {
    const result = await new Promise((resolve) => {
      const child = spawn(
        "node",
        ["dist/cli/runPipelineTrigger.js", "--source", "cron", "--keyword", "카카오", "--trace-id", "cli-trace"],
        {
          cwd: process.cwd(),
          env: { ...process.env, GONGSIRI_PIPELINE_API_URL: endpointUrl }
        }
      );
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf-8");
      child.stderr.setEncoding("utf-8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });

    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.triggerSource, "cron");
    assert.equal(parsed.traceId, "cli-trace");
    assert.equal(runAnalysisPipelineToolDescriptor.name, "run_analysis_pipeline");
    assert.equal(runAnalysisPipelineToolDescriptor.httpEndpoint, "POST /analysis/pipeline");
    assert.equal(receivedBodies[0].source, "cron");
    assert.equal(receivedBodies[0].keyword, "카카오");
    assert.equal(receivedBodies[0].traceId, "cli-trace");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
