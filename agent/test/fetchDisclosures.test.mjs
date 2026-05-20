import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFetchDisclosuresTool } from "../dist/tools/fetchDisclosures.js";
import { createRuntimeSkeleton, runManualPrompt } from "../dist/index.js";

const makeExecutable = (name, body) => {
  const dir = mkdtempSync(join(tmpdir(), "gongsiri-agent-"));
  const scriptPath = join(dir, name);
  writeFileSync(scriptPath, body, { encoding: "utf-8" });
  chmodSync(scriptPath, 0o755);

  return {
    scriptPath,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
};

test("createFetchDisclosuresTool parses successful bridge output", async () => {
  const { scriptPath, cleanup } = makeExecutable(
    "python-success.sh",
    `#!/bin/sh
printf '%s\n' '{"ok":true,"traceId":"tool-trace","contractVersion":"v1","observedAt":"2026-05-20T12:00:00Z","data":{"corpCode":"00258801","company":{"corp_name":"카카오","stock_code":"035720","corp_code":"00258801","market":"KOSPI"},"disclosures":[]},"evidence":[]}'
`
  );

  try {
    const tool = createFetchDisclosuresTool({
      pythonBin: scriptPath,
      repoRoot: process.cwd()
    });

    const result = await tool.invoke({ keyword: "카카오", traceId: "tool-trace" });

    assert.equal(result.ok, true);
    assert.equal(result.traceId, "tool-trace");
    assert.equal(result.data.corpCode, "00258801");
  } finally {
    cleanup();
  }
});

test("createFetchDisclosuresTool maps malformed stdout to typed failure", async () => {
  const { scriptPath, cleanup } = makeExecutable(
    "python-malformed.sh",
    `#!/bin/sh
printf '%s\n' 'not-json'
`
  );

  try {
    const tool = createFetchDisclosuresTool({
      pythonBin: scriptPath,
      repoRoot: process.cwd()
    });

    const result = await tool.invoke({ corpCode: "00126380", traceId: "malformed-trace" });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "bridge_malformed_output");
    assert.equal(result.traceId, "malformed-trace");
  } finally {
    cleanup();
  }
});

test("createFetchDisclosuresTool maps nonzero exit without stdout to bridge_process_failed", async () => {
  const { scriptPath, cleanup } = makeExecutable(
    "python-fail.sh",
    `#!/bin/sh
printf '%s\n' 'bridge failed' >&2
exit 1
`
  );

  try {
    const tool = createFetchDisclosuresTool({
      pythonBin: scriptPath,
      repoRoot: process.cwd()
    });

    const result = await tool.invoke({ corpCode: "00126380", traceId: "failed-trace" });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "bridge_process_failed");
    assert.equal(result.traceId, "failed-trace");
  } finally {
    cleanup();
  }
});

test("createFetchDisclosuresTool pins canonical python execution to repo root", async () => {
  const tool = createFetchDisclosuresTool();
  const result = await tool.invoke({ corpCode: "00126380", traceId: "repo-root-trace" });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "missing_env");
  assert.equal(result.traceId, "repo-root-trace");
});

test("runManualPrompt routes disclosure prompts through the skill and tool", async () => {
  const tool = {
    descriptor: {
      name: "fetch_disclosures",
      description: "stub",
      canonicalCommand: "python -m backend.collector.cli.fetch_disclosures"
    },
    async invoke(request) {
      assert.equal(request.keyword, "카카오");
      assert.equal(request.traceId, "manual-trace");

      return {
        ok: true,
        traceId: "manual-trace",
        contractVersion: "v1",
        observedAt: "2026-05-20T12:00:00Z",
        data: {
          corpCode: "00258801",
          company: null,
          disclosures: []
        },
        evidence: []
      };
    }
  };

  const response = await runManualPrompt("카카오 공시 조회", {
    traceId: "manual-trace",
    tool
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
    PYTHON_BIN: process.env.PYTHON_BIN
  };

  process.env.UPSTAGE_API_KEY = "test-upstage-key";
  process.env.UPSTAGE_MODEL = "solar-mini";
  process.env.PYTHON_BIN = "/custom/python3";

  try {
    const runtime = createRuntimeSkeleton(
      {
        text: "삼성전자 공시 조회",
        traceId: "session-trace",
        contractVersion: "v1"
      },
      {
        descriptor: {
          name: "fetch_disclosures",
          description: "stub",
          canonicalCommand: "python -m backend.collector.cli.fetch_disclosures"
        },
        invoke: async () => {
          throw new Error("not called");
        }
      }
    );

    assert.equal(runtime.session.traceId, "session-trace");
    assert.equal(runtime.session.pythonBin, "/custom/python3");
    assert.deepEqual(runtime.session.solar, {
      apiKey: "test-upstage-key",
      model: "solar-mini"
    });
  } finally {
    process.env.UPSTAGE_API_KEY = originalEnv.UPSTAGE_API_KEY;
    process.env.UPSTAGE_MODEL = originalEnv.UPSTAGE_MODEL;
    process.env.PYTHON_BIN = originalEnv.PYTHON_BIN;
  }
});
