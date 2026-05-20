import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  createRunAnalysisPipelineTool,
  runAnalysisPipelineToolDescriptor
} from "../dist/tools/runAnalysisPipeline.js";

const makeExecutable = (name, body) => {
  const dir = mkdtempSync(join(tmpdir(), "gongsiri-pipeline-"));
  const scriptPath = join(dir, name);
  writeFileSync(scriptPath, body, { encoding: "utf-8" });
  chmodSync(scriptPath, 0o755);

  return {
    scriptPath,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
};

test("runAnalysisPipelineTool parses successful bridge output", async () => {
  const { scriptPath, cleanup } = makeExecutable(
    "python-success.sh",
    `#!/bin/sh
printf '%s\n' '{"ok":true,"triggerSource":"user","traceId":"pipeline-trace","contractVersion":"v1","observedAt":"2026-05-20T12:00:00Z","result":{"normalized_data_bundle":{"company":{"corp_name":"카카오"}},"analysis_result":{"risk_score":2,"risk_level":"caution","checklist":[],"short_term_report":"short","long_term_report":"long","disclaimer":"disc","missing_evidence":[]},"preparation":{"persistence":{},"notification":{}}},"evidence":[]}'
`
  );

  try {
    const tool = createRunAnalysisPipelineTool({ pythonBin: scriptPath, repoRoot: process.cwd() });
    const result = await tool.invoke({ source: "user", keyword: "카카오", traceId: "pipeline-trace" });

    assert.equal(result.ok, true);
    assert.equal(result.traceId, "pipeline-trace");
    assert.equal(result.result.analysis_result.risk_level, "caution");
  } finally {
    cleanup();
  }
});

test("runAnalysisPipelineTool maps malformed output to typed failure", async () => {
  const { scriptPath, cleanup } = makeExecutable(
    "python-malformed.sh",
    `#!/bin/sh
printf '%s\n' 'not-json'
`
  );

  try {
    const tool = createRunAnalysisPipelineTool({ pythonBin: scriptPath, repoRoot: process.cwd() });
    const result = await tool.invoke({ source: "cron", keyword: "카카오" });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "pipeline_malformed_output");
  } finally {
    cleanup();
  }
});

test("runAnalysisPipelineTool pins canonical python execution to repo root", async () => {
  const result = await createRunAnalysisPipelineTool().invoke({
    source: "system",
    keyword: "카카오",
    traceId: "pipeline-root-trace"
  });

  assert.equal(result.ok, true);
  assert.equal(result.triggerSource, "system");
  assert.equal(result.traceId, "pipeline-root-trace");
  assert.equal(result.result.analysis_result.risk_level, "normal");
});

test("pipeline CLI emits typed envelope from agent/", () => {
  const { scriptPath, cleanup } = makeExecutable(
    "python-success.sh",
    `#!/bin/sh
printf '%s\n' '{"ok":true,"triggerSource":"cron","traceId":"cli-trace","contractVersion":"v1","observedAt":"2026-05-20T12:00:00Z","result":{"normalized_data_bundle":{"company":{"corp_name":"카카오"}},"analysis_result":{"risk_score":1,"risk_level":"normal","checklist":[],"short_term_report":"short","long_term_report":"long","disclaimer":"disc","missing_evidence":[]},"preparation":{"persistence":{},"notification":{}}},"evidence":[]}'
`
  );

  try {
    const result = spawnSync(
      "node",
      ["dist/cli/runPipelineTrigger.js", "--source", "cron", "--keyword", "카카오", "--trace-id", "cli-trace"],
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: { ...process.env, PYTHON_BIN: scriptPath }
      }
    );

    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.triggerSource, "cron");
    assert.equal(parsed.traceId, "cli-trace");
    assert.equal(runAnalysisPipelineToolDescriptor.name, "run_analysis_pipeline");
  } finally {
    cleanup();
  }
});
