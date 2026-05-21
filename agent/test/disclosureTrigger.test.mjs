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


const makeFetchTool = (invoke) => ({
  descriptor: {
    name: "fetch_disclosures",
    description: "stub",
    canonicalCommand: "python -m backend.collector.cli.fetch_disclosures"
  },
  invoke
});

const makeFetchSuccess = ({ traceId, corpCode = "00258801", disclosures }) => ({
  ok: true,
  traceId,
  contractVersion: "v1",
  observedAt: "2026-05-20T14:00:00Z",
  data: {
    corpCode,
    company: null,
    disclosures
  },
  evidence: []
});

const makePipelineSuccess = ({ traceId = "pipeline-trace", source = "cron" } = {}) => ({
  ok: true,
  triggerSource: source,
  traceId,
  contractVersion: "v1",
  observedAt: "2026-05-20T14:00:01Z",
  result: {
    normalized_data_bundle: {},
    analysis_result: {
      risk_score: 2,
      risk_level: "caution",
      checklist: [],
      short_term_report: "단기 리포트",
      long_term_report: "장기 리포트",
      disclaimer: "투자 참고용입니다.",
      missing_evidence: []
    },
    preparation: {
      persistence: {},
      notification: {}
    }
  },
  evidence: []
});

test("first cron trigger initializes checkpoint without invoking pipeline", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  const pipelineCalls = [];

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "cron",
      keyword: "카카오",
      traceId: "first-cron"
    }),
    {
      checkpointStore,
      tool: makeFetchTool(async () =>
        makeFetchSuccess({
          traceId: "first-cron",
          disclosures: [
            { rcept_no: "202605200100", report_nm: "사업보고서", rcept_dt: "20260520" }
          ]
        })
      ),
      pipelineRunner: async (request) => {
        pipelineCalls.push(request);
        return makePipelineSuccess({ traceId: request.traceId, source: request.source });
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.hasNewDisclosure, false);
  assert.equal(result.pipelineResult, undefined);
  assert.deepEqual(pipelineCalls, []);
  assert.equal(checkpointStore.read("00258801"), "202605200100");
});

test("subsequent cron trigger with new disclosure invokes pipeline exactly once", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  checkpointStore.write("00258801", "202605200100");
  const pipelineCalls = [];

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "cron",
      keyword: "카카오",
      traceId: "new-cron"
    }),
    {
      checkpointStore,
      tool: makeFetchTool(async () =>
        makeFetchSuccess({
          traceId: "new-cron",
          disclosures: [
            { rcept_no: "202605200101", report_nm: "신규 공시", rcept_dt: "20260520" },
            { rcept_no: "202605200100", report_nm: "사업보고서", rcept_dt: "20260520" }
          ]
        })
      ),
      pipelineRunner: async (request) => {
        pipelineCalls.push(request);
        return makePipelineSuccess({ traceId: request.traceId, source: request.source });
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.hasNewDisclosure, true);
  assert.equal(result.pipelineResult.ok, true);
  assert.equal(pipelineCalls.length, 1);
  assert.deepEqual(pipelineCalls[0], {
    source: "cron",
    corpCode: "00258801",
    keyword: "카카오",
    traceId: "new-cron",
    contractVersion: "v1",
    metadata: {
      runReason: "new disclosure detected",
      newDisclosureCount: 1,
      newDisclosureIds: ["202605200101"]
    }
  });
});

test("manual user trigger invokes pipeline even when no new disclosure is detected", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  checkpointStore.write("00258801", "202605200100");
  const pipelineCalls = [];

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "user",
      keyword: "카카오",
      traceId: "manual-no-new"
    }),
    {
      checkpointStore,
      tool: makeFetchTool(async () =>
        makeFetchSuccess({
          traceId: "manual-no-new",
          disclosures: [
            { rcept_no: "202605200100", report_nm: "사업보고서", rcept_dt: "20260520" }
          ]
        })
      ),
      pipelineRunner: async (request) => {
        pipelineCalls.push(request);
        return makePipelineSuccess({ traceId: request.traceId, source: request.source });
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.hasNewDisclosure, false);
  assert.equal(result.pipelineResult.ok, true);
  assert.equal(pipelineCalls.length, 1);
  assert.equal(pipelineCalls[0].source, "user");
  assert.equal(pipelineCalls[0].metadata.runReason, "manual disclosure check");
});

test("fetch failure does not invoke pipeline and does not advance checkpoint", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  checkpointStore.write("카카오", "202605200100");
  const pipelineCalls = [];

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "cron",
      keyword: "카카오",
      traceId: "fetch-failure"
    }),
    {
      checkpointStore,
      tool: makeFetchTool(async () => ({
        ok: false,
        traceId: "fetch-failure",
        contractVersion: "v1",
        observedAt: "2026-05-20T14:00:00Z",
        error: { code: "missing_env", message: "DART_API_KEY가 없습니다." },
        evidence: []
      })),
      pipelineRunner: async (request) => {
        pipelineCalls.push(request);
        return makePipelineSuccess({ traceId: request.traceId, source: request.source });
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.pipelineResult, undefined);
  assert.deepEqual(pipelineCalls, []);
  assert.equal(checkpointStore.read("카카오"), "202605200100");
});

test("pipeline failure is nested without erasing disclosure evidence", async () => {
  const checkpointPath = makeCheckpointPath();
  const checkpointStore = new LocalDisclosureCheckpointStore(checkpointPath);
  checkpointStore.write("00258801", "202605200100");

  const result = await runTriggeredDisclosureCheck(
    createDisclosureTriggerRequest({
      source: "cron",
      keyword: "카카오",
      traceId: "pipeline-failure"
    }),
    {
      checkpointStore,
      tool: makeFetchTool(async () =>
        makeFetchSuccess({
          traceId: "pipeline-failure",
          disclosures: [
            { rcept_no: "202605200101", report_nm: "신규 공시", rcept_dt: "20260520" },
            { rcept_no: "202605200100", report_nm: "사업보고서", rcept_dt: "20260520" }
          ]
        })
      ),
      pipelineRunner: async (request) => ({
        ok: false,
        triggerSource: request.source,
        traceId: request.traceId,
        contractVersion: "v1",
        observedAt: "2026-05-20T14:00:01Z",
        error: { code: "analysis_failed", message: "pipeline failed" },
        evidence: []
      })
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.result.ok, true);
  assert.equal(result.pipelineResult.ok, false);
  assert.equal(result.pipelineResult.error.code, "analysis_failed");
  assert.deepEqual(result.newDisclosureIds, ["202605200101"]);
});
