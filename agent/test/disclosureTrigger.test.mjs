import test from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { createDisclosureScheduler } from "../dist/scheduler/disclosureScheduler.js";
import { LocalDisclosureCheckpointStore } from "../dist/state/disclosureCheckpoint.js";
import {
  createDisclosureTriggerRequest,
  runTriggeredDisclosureCheck
} from "../dist/triggers/disclosureTrigger.js";

const makeTempDir = () => mkdtempSync(join(tmpdir(), "gongsiri-trigger-"));

const makeCheckpointPath = () => join(makeTempDir(), "checkpoints.json");

const makeExecutable = (name, body) => {
  const dir = makeTempDir();
  const scriptPath = join(dir, name);
  writeFileSync(scriptPath, body, { encoding: "utf-8" });
  chmodSync(scriptPath, 0o755);

  return {
    scriptPath,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
};

test("createDisclosureTriggerRequest supports only user/system/cron", () => {
  const request = createDisclosureTriggerRequest({
    source: "system",
    keyword: "카카오",
    traceId: "trigger-trace",
    intervalMinutes: 30,
    runReason: "manual verification"
  });

  assert.equal(request.source, "system");
  assert.equal(request.keyword, "카카오");
  assert.equal(request.metadata.intervalMinutes, 30);
  assert.equal(request.traceId, "trigger-trace");
});

test("first successful trigger initializes checkpoint without reporting all disclosures as new", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "user",
      keyword: "카카오",
      traceId: "first-run"
    }),
    {
      checkpointStore,
      tool: {
        descriptor: {
          name: "fetch_disclosures",
          description: "stub",
          canonicalCommand: "python -m backend.collector.cli.fetch_disclosures"
        },
        invoke: async () => ({
          ok: true,
          traceId: "first-run",
          contractVersion: "v1",
          observedAt: "2026-05-20T12:00:00Z",
          data: {
            corpCode: "00258801",
            company: null,
            disclosures: [
              { rcept_no: "202605200002", report_nm: "사업보고서", rcept_dt: "20260520" },
              { rcept_no: "202605200001", report_nm: "분기보고서", rcept_dt: "20260520" }
            ]
          },
          evidence: []
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.hasNewDisclosure, false);
  assert.equal(result.newDisclosureCount, 0);
  assert.equal(result.checkpoint.previousLastSeen, null);
  assert.equal(result.checkpoint.currentLastSeen, "202605200002");
  assert.equal(checkpointStore.read("00258801"), "202605200002");
  assert.equal(checkpointStore.read("카카오"), null);
});

test("subsequent successful trigger reports only unseen disclosures", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  checkpointStore.write("카카오", "202605200002");

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "cron",
      keyword: "카카오",
      traceId: "cron-run"
    }),
    {
      checkpointStore,
      tool: {
        descriptor: {
          name: "fetch_disclosures",
          description: "stub",
          canonicalCommand: "python -m backend.collector.cli.fetch_disclosures"
        },
        invoke: async () => ({
          ok: true,
          traceId: "cron-run",
          contractVersion: "v1",
          observedAt: "2026-05-20T12:10:00Z",
          data: {
            corpCode: "00258801",
            company: null,
            disclosures: [
              { rcept_no: "202605200004", report_nm: "신규 공시", rcept_dt: "20260520" },
              { rcept_no: "202605200003", report_nm: "신규 공시", rcept_dt: "20260520" },
              { rcept_no: "202605200002", report_nm: "사업보고서", rcept_dt: "20260520" }
            ]
          },
          evidence: []
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.hasNewDisclosure, true);
  assert.deepEqual(result.newDisclosureIds, ["202605200004", "202605200003"]);
  assert.equal(result.checkpoint.previousLastSeen, "202605200002");
  assert.equal(result.checkpoint.currentLastSeen, "202605200004");
  assert.equal(checkpointStore.read("00258801"), "202605200004");
});

test("failed trigger does not advance checkpoint", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  checkpointStore.write("카카오", "202605200004");

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "system",
      keyword: "카카오",
      traceId: "failed-run"
    }),
    {
      checkpointStore,
      tool: {
        descriptor: {
          name: "fetch_disclosures",
          description: "stub",
          canonicalCommand: "python -m backend.collector.cli.fetch_disclosures"
        },
        invoke: async () => ({
          ok: false,
          traceId: "failed-run",
          contractVersion: "v1",
          observedAt: "2026-05-20T12:20:00Z",
          error: {
            code: "missing_env",
            message: "DART_API_KEY가 .env에 없습니다."
          },
          evidence: []
        })
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.hasNewDisclosure, false);
  assert.equal(checkpointStore.read("카카오"), "202605200004");
});

test("keyword then corpCode runs share the same checkpoint continuity", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);

  await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "user",
      keyword: "카카오",
      traceId: "keyword-first"
    }),
    {
      checkpointStore,
      tool: {
        descriptor: {
          name: "fetch_disclosures",
          description: "stub",
          canonicalCommand: "python -m backend.collector.cli.fetch_disclosures"
        },
        invoke: async () => ({
          ok: true,
          traceId: "keyword-first",
          contractVersion: "v1",
          observedAt: "2026-05-20T12:50:00Z",
          data: {
            corpCode: "00258801",
            company: null,
            disclosures: [{ rcept_no: "202605200020", report_nm: "사업보고서", rcept_dt: "20260520" }]
          },
          evidence: []
        })
      }
    }
  );

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "cron",
      corpCode: "00258801",
      traceId: "corpcode-second"
    }),
    {
      checkpointStore,
      tool: {
        descriptor: {
          name: "fetch_disclosures",
          description: "stub",
          canonicalCommand: "python -m backend.collector.cli.fetch_disclosures"
        },
        invoke: async () => ({
          ok: true,
          traceId: "corpcode-second",
          contractVersion: "v1",
          observedAt: "2026-05-20T13:00:00Z",
          data: {
            corpCode: "00258801",
            company: null,
            disclosures: [
              { rcept_no: "202605200021", report_nm: "신규 공시", rcept_dt: "20260520" },
              { rcept_no: "202605200020", report_nm: "사업보고서", rcept_dt: "20260520" }
            ]
          },
          evidence: []
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.checkpoint.previousLastSeen, "202605200020");
  assert.equal(result.hasNewDisclosure, true);
  assert.deepEqual(result.newDisclosureIds, ["202605200021"]);
});

test("corpCode then keyword runs share the same checkpoint continuity", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  checkpointStore.write("00258801", "202605200030");

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "system",
      keyword: "카카오",
      traceId: "keyword-second"
    }),
    {
      checkpointStore,
      tool: {
        descriptor: {
          name: "fetch_disclosures",
          description: "stub",
          canonicalCommand: "python -m backend.collector.cli.fetch_disclosures"
        },
        invoke: async () => ({
          ok: true,
          traceId: "keyword-second",
          contractVersion: "v1",
          observedAt: "2026-05-20T13:10:00Z",
          data: {
            corpCode: "00258801",
            company: null,
            disclosures: [
              { rcept_no: "202605200031", report_nm: "신규 공시", rcept_dt: "20260520" },
              { rcept_no: "202605200030", report_nm: "사업보고서", rcept_dt: "20260520" }
            ]
          },
          evidence: []
        })
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.checkpoint.previousLastSeen, "202605200030");
  assert.equal(result.hasNewDisclosure, true);
  assert.deepEqual(result.newDisclosureIds, ["202605200031"]);
  assert.equal(checkpointStore.read("00258801"), "202605200031");
});

test("scheduler runOnce always sends cron source", async () => {
  let observedSource = null;
  const scheduler = createDisclosureScheduler({
    run: async (request) => {
      observedSource = request.source;

      return {
        ok: true,
        triggerSource: request.source,
        traceId: request.traceId ?? "scheduler-trace",
        contractVersion: request.contractVersion ?? "v1",
        hasNewDisclosure: false,
        newDisclosureCount: 0,
        newDisclosureIds: [],
        checkpoint: {
          checkpointPath: "/tmp/checkpoints.json",
          previousLastSeen: null,
          currentLastSeen: null
        },
        result: {
          ok: true,
          traceId: request.traceId ?? "scheduler-trace",
          contractVersion: request.contractVersion ?? "v1",
          observedAt: "2026-05-20T12:30:00Z",
          data: {
            corpCode: "00258801",
            company: null,
            disclosures: []
          },
          evidence: []
        }
      };
    }
  });

  const result = await scheduler.runOnce({
    keyword: "카카오",
    traceId: "scheduler-run"
  });

  assert.equal(observedSource, "cron");
  assert.equal(result.triggerSource, "cron");
});

test("CLI one-off trigger from agent/ returns typed trigger envelope", () => {
  const { scriptPath, cleanup } = makeExecutable(
    "python-success.sh",
    `#!/bin/sh
printf '%s\n' '{"ok":true,"traceId":"cli-trace","contractVersion":"v1","observedAt":"2026-05-20T12:40:00Z","data":{"corpCode":"00258801","company":{"corp_name":"카카오","stock_code":"035720","corp_code":"00258801","market":"KOSPI"},"disclosures":[{"rcept_no":"202605200010","report_nm":"사업보고서","rcept_dt":"20260520"}]},"evidence":[]}'
`
  );
  const checkpointPath = makeCheckpointPath();

  try {
    const result = spawnSync(
      "node",
      [
        "dist/cli/runDisclosureTrigger.js",
        "--source",
        "user",
        "--keyword",
        "카카오",
        "--trace-id",
        "cli-trace"
      ],
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: {
          ...process.env,
          PYTHON_BIN: scriptPath,
          GONGSIRI_CHECKPOINT_PATH: checkpointPath
        }
      }
    );

    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.triggerSource, "user");
    assert.equal(parsed.traceId, "cli-trace");
    assert.equal(parsed.hasNewDisclosure, false);
    assert.equal(existsSync(checkpointPath), true);
    assert.equal(
      JSON.parse(readFileSync(checkpointPath, "utf-8")).disclosures["00258801"],
      "202605200010"
    );
  } finally {
    cleanup();
    rmSync(checkpointPath.replace(/\/checkpoints\.json$/, ""), { recursive: true, force: true });
  }
});

test("first cron run initializes checkpoint without invoking pipeline for historical disclosures", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  const pipelineCalls = [];

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({ source: "cron", keyword: "카카오", traceId: "first-cron" }),
    {
      checkpointStore,
      tool: {
        descriptor: { name: "fetch_disclosures", description: "stub", canonicalCommand: "stub" },
        invoke: async () => ({
          ok: true,
          traceId: "first-cron",
          contractVersion: "v1",
          observedAt: "2026-05-20T12:00:00Z",
          data: {
            corpCode: "00258801",
            company: null,
            disclosures: [
              { rcept_no: "202605200002", report_nm: "사업보고서", rcept_dt: "20260520" },
              { rcept_no: "202605200001", report_nm: "분기보고서", rcept_dt: "20260520" }
            ]
          },
          evidence: []
        })
      },
      pipelineTool: {
        invoke: async (request) => {
          pipelineCalls.push(request);
          return { ok: true };
        }
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.hasNewDisclosure, false);
  assert.equal(pipelineCalls.length, 0);
});

test("subsequent cron run with new disclosures invokes pipeline once with canonical corpCode", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  checkpointStore.write("00258801", "202605200002");
  const pipelineCalls = [];

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({ source: "cron", keyword: "카카오", traceId: "cron-new" }),
    {
      checkpointStore,
      tool: {
        descriptor: { name: "fetch_disclosures", description: "stub", canonicalCommand: "stub" },
        invoke: async () => ({
          ok: true,
          traceId: "cron-new",
          contractVersion: "v1",
          observedAt: "2026-05-20T12:10:00Z",
          data: {
            corpCode: "00258801",
            company: null,
            disclosures: [
              { rcept_no: "202605200003", report_nm: "신규 공시", rcept_dt: "20260520" },
              { rcept_no: "202605200002", report_nm: "사업보고서", rcept_dt: "20260520" }
            ]
          },
          evidence: []
        })
      },
      pipelineTool: {
        invoke: async (request) => {
          pipelineCalls.push(request);
          return {
            ok: true,
            triggerSource: request.source,
            traceId: request.traceId,
            contractVersion: request.contractVersion,
            observedAt: "2026-05-20T12:11:00Z",
            result: { normalized_data_bundle: {}, analysis_result: {}, preparation: {} },
            evidence: []
          };
        }
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(pipelineCalls.length, 1);
  assert.deepEqual(pipelineCalls[0], {
    source: "cron",
    corpCode: "00258801",
    keyword: "카카오",
    traceId: "cron-new",
    contractVersion: "v1"
  });
  assert.equal(result.pipelineResult.ok, true);
});

test("manual user trigger invokes pipeline even without a new disclosure", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  checkpointStore.write("00258801", "202605200010");
  const pipelineCalls = [];

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({ source: "user", keyword: "카카오", traceId: "manual-no-new" }),
    {
      checkpointStore,
      tool: {
        descriptor: { name: "fetch_disclosures", description: "stub", canonicalCommand: "stub" },
        invoke: async () => ({
          ok: true,
          traceId: "manual-no-new",
          contractVersion: "v1",
          observedAt: "2026-05-20T12:30:00Z",
          data: {
            corpCode: "00258801",
            company: null,
            disclosures: [
              { rcept_no: "202605200010", report_nm: "사업보고서", rcept_dt: "20260520" }
            ]
          },
          evidence: []
        })
      },
      pipelineTool: {
        invoke: async (request) => {
          pipelineCalls.push(request);
          return {
            ok: false,
            triggerSource: request.source,
            traceId: request.traceId,
            contractVersion: request.contractVersion,
            observedAt: "2026-05-20T12:31:00Z",
            error: { code: "pipeline_failed", message: "stub failure" },
            evidence: []
          };
        }
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.hasNewDisclosure, false);
  assert.equal(pipelineCalls.length, 1);
  assert.equal(result.pipelineResult.ok, false);
  assert.equal(result.pipelineResult.error.code, "pipeline_failed");
});
