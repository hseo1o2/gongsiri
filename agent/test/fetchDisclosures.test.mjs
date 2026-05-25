import test from "node:test";
import assert from "node:assert/strict";

import { createFetchDisclosuresTool } from "../dist/tools/fetchDisclosures.js";
import { createRuntimeSkeleton, runManualPrompt } from "../dist/index.js";

const makeResponse = (status, bodyObject) => ({
  ok: status >= 200 && status < 300,
  status,
  async text() {
    return typeof bodyObject === "string"
      ? bodyObject
      : JSON.stringify(bodyObject);
  },
});

test("createFetchDisclosuresTool parses successful backend response", async () => {
  const calls = [];
  const tool = createFetchDisclosuresTool({
    backendUrl: "http://backend.test:8000",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return makeResponse(200, {
        ok: true,
        traceId: "tool-trace",
        contractVersion: "v1",
        observedAt: "2026-05-25T12:00:00Z",
        data: {
          corpCode: "00258801",
          company: {
            corp_name: "카카오",
            stock_code: "035720",
            corp_code: "00258801",
            market: "KOSPI",
          },
          disclosures: [],
        },
        evidence: [],
      });
    },
  });

  const result = await tool.invoke({
    keyword: "카카오",
    traceId: "tool-trace",
  });

  assert.equal(result.ok, true);
  assert.equal(result.traceId, "tool-trace");
  assert.equal(result.data.corpCode, "00258801");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://backend.test:8000/internal/disclosures");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["content-type"], "application/json");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.keyword, "카카오");
  assert.equal(body.traceId, "tool-trace");
  assert.equal(body.contractVersion, "v1");
});

test("createFetchDisclosuresTool maps malformed body to bridge_malformed_output", async () => {
  const tool = createFetchDisclosuresTool({
    backendUrl: "http://backend.test:8000",
    fetchImpl: async () => makeResponse(200, "not-json"),
  });

  const result = await tool.invoke({
    corpCode: "00126380",
    traceId: "malformed-trace",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "bridge_malformed_output");
  assert.equal(result.traceId, "malformed-trace");
});

test("createFetchDisclosuresTool passes typed failure envelope through unchanged", async () => {
  const tool = createFetchDisclosuresTool({
    backendUrl: "http://backend.test:8000",
    fetchImpl: async () =>
      makeResponse(503, {
        ok: false,
        traceId: "missing-env-trace",
        contractVersion: "v1",
        observedAt: "2026-05-25T12:00:00Z",
        error: {
          code: "missing_env",
          message: "DART_API_KEY가 .env에 없습니다.",
        },
        evidence: [],
      }),
  });

  const result = await tool.invoke({
    corpCode: "00126380",
    traceId: "missing-env-trace",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "missing_env");
  assert.equal(result.traceId, "missing-env-trace");
});

test("createFetchDisclosuresTool maps empty body with non-2xx status to bridge_process_failed", async () => {
  const tool = createFetchDisclosuresTool({
    backendUrl: "http://backend.test:8000",
    fetchImpl: async () => makeResponse(500, ""),
  });

  const result = await tool.invoke({
    corpCode: "00126380",
    traceId: "empty-trace",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "bridge_process_failed");
  assert.equal(result.traceId, "empty-trace");
});

test("createFetchDisclosuresTool maps fetch throw to bridge_process_failed", async () => {
  const tool = createFetchDisclosuresTool({
    backendUrl: "http://backend.test:8000",
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });

  const result = await tool.invoke({
    corpCode: "00126380",
    traceId: "throw-trace",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "bridge_process_failed");
  assert.match(result.error.message, /ECONNREFUSED/);
});

test("createFetchDisclosuresTool resolves backend url from AGENT_BACKEND_URL env override", async () => {
  const calls = [];
  const tool = createFetchDisclosuresTool({
    env: { AGENT_BACKEND_URL: "http://backend.from-env:9000/" },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return makeResponse(200, {
        ok: true,
        traceId: "env-trace",
        contractVersion: "v1",
        observedAt: "2026-05-25T12:00:00Z",
        data: { corpCode: "00258801", company: null, disclosures: [] },
        evidence: [],
      });
    },
  });

  const result = await tool.invoke({ keyword: "카카오", traceId: "env-trace" });

  assert.equal(result.ok, true);
  assert.equal(
    calls[0].url,
    "http://backend.from-env:9000/internal/disclosures",
  );
});

test("runManualPrompt routes disclosure prompts through the skill and tool", async () => {
  const tool = {
    descriptor: {
      name: "fetch_disclosures",
      description: "stub",
      canonicalCommand: "POST /internal/disclosures",
    },
    async invoke(request) {
      assert.equal(request.keyword, "카카오");
      assert.equal(request.traceId, "manual-trace");

      return {
        ok: true,
        traceId: "manual-trace",
        contractVersion: "v1",
        observedAt: "2026-05-25T12:00:00Z",
        data: {
          corpCode: "00258801",
          company: null,
          disclosures: [],
        },
        evidence: [],
      };
    },
  };

  const response = await runManualPrompt("카카오 공시 조회", {
    traceId: "manual-trace",
    tool,
  });

  assert.equal(response.agent, "PiDisclosureAgent");
  assert.equal(response.skill, "disclosure-intake-skill");
  assert.equal(response.tool, "fetch_disclosures");
  assert.equal(response.result.ok, true);
});

test("createRuntimeSkeleton resolves session config from env", () => {
  const originalEnv = {
    UPSTAGE_API_KEY: process.env.UPSTAGE_API_KEY,
    UPSTAGE_MODEL: process.env.UPSTAGE_MODEL,
    PYTHON_BIN: process.env.PYTHON_BIN,
  };

  process.env.UPSTAGE_API_KEY = "test-upstage-key";
  process.env.UPSTAGE_MODEL = "solar-mini";
  process.env.PYTHON_BIN = "/custom/python3";

  try {
    const runtime = createRuntimeSkeleton(
      {
        text: "삼성전자 공시 조회",
        traceId: "session-trace",
        contractVersion: "v1",
      },
      {
        descriptor: {
          name: "fetch_disclosures",
          description: "stub",
          canonicalCommand: "POST /internal/disclosures",
        },
        invoke: async () => {
          throw new Error("not called");
        },
      },
    );

    assert.equal(runtime.session.traceId, "session-trace");
    assert.equal(runtime.session.pythonBin, "/custom/python3");
    assert.deepEqual(runtime.session.solar, {
      apiKey: "test-upstage-key",
      model: "solar-mini",
    });
  } finally {
    process.env.UPSTAGE_API_KEY = originalEnv.UPSTAGE_API_KEY;
    process.env.UPSTAGE_MODEL = originalEnv.UPSTAGE_MODEL;
    process.env.PYTHON_BIN = originalEnv.PYTHON_BIN;
  }
});
