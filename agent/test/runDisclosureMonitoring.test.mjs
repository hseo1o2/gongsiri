import test from "node:test";
import assert from "node:assert/strict";

import { runDisclosureMonitoring } from "../dist/triggers/runDisclosureMonitoring.js";
import { createDisclosureTriggerRequest } from "../dist/triggers/disclosureTrigger.js";

const makeToolResultSuccess = (corpCode = "00258801") => ({
  ok: true,
  traceId: "test-trace",
  contractVersion: "v1",
  observedAt: "2026-05-25T00:00:00Z",
  data: {
    corpCode,
    company: { corp_name: "카카오", stock_code: "035720" },
    disclosures: [
      {
        rcept_no: "20260525000001",
        report_nm: "주요사항보고서",
        rcept_dt: "20260525",
      },
    ],
  },
  evidence: [],
});

const makeTriggeredResult = ({
  hasNewDisclosure,
  newDisclosureIds = [],
} = {}) => ({
  ok: true,
  triggerSource: "cron",
  traceId: "test-trace",
  contractVersion: "v1",
  hasNewDisclosure,
  newDisclosureCount: newDisclosureIds.length,
  newDisclosureIds,
  checkpoint: {
    checkpointPath: "/tmp/checkpoints.json",
    previousLastSeen: "20260524",
    currentLastSeen: "20260525",
  },
  result: makeToolResultSuccess(),
});

const makeRequest = () =>
  createDisclosureTriggerRequest({
    source: "cron",
    keyword: "카카오",
    corpCode: "00258801",
    traceId: "test-trace",
    intervalMinutes: 30,
  });

test("runDisclosureMonitoring: no new disclosure → reportRefresh not called", async () => {
  const refreshCalls = [];

  await runDisclosureMonitoring(makeRequest(), {
    triggerCheck: async () => makeTriggeredResult({ hasNewDisclosure: false }),
    reportRefresh: async (r) => {
      refreshCalls.push(r);
    },
  });

  assert.equal(
    refreshCalls.length,
    0,
    "reportRefresh must not fire when no new disclosure",
  );
});

test("runDisclosureMonitoring: new disclosures → reportRefresh called once with corpCode/keyword/traceId", async () => {
  const refreshCalls = [];

  await runDisclosureMonitoring(makeRequest(), {
    triggerCheck: async () =>
      makeTriggeredResult({
        hasNewDisclosure: true,
        newDisclosureIds: ["20260525000001", "20260525000002"],
      }),
    reportRefresh: async (r) => {
      refreshCalls.push(r);
    },
  });

  assert.equal(refreshCalls.length, 1, "reportRefresh must fire exactly once");
  assert.equal(refreshCalls[0].corpCode, "00258801");
  assert.equal(refreshCalls[0].keyword, "카카오");
  assert.equal(refreshCalls[0].traceId, "test-trace");
});

test("runDisclosureMonitoring: trigger throws → reportRefresh not called, no rethrow", async () => {
  const refreshCalls = [];

  await runDisclosureMonitoring(makeRequest(), {
    triggerCheck: async () => {
      throw new Error("dart down");
    },
    reportRefresh: async (r) => {
      refreshCalls.push(r);
    },
  });

  assert.equal(refreshCalls.length, 0);
});

test("runDisclosureMonitoring: trigger returns ok=false → reportRefresh not called", async () => {
  const refreshCalls = [];

  await runDisclosureMonitoring(makeRequest(), {
    triggerCheck: async () => ({
      ok: false,
      triggerSource: "cron",
      traceId: "test-trace",
      contractVersion: "v1",
      error: { code: "dart_failed", message: "DART API failed" },
    }),
    reportRefresh: async (r) => {
      refreshCalls.push(r);
    },
  });

  assert.equal(refreshCalls.length, 0);
});

test("runDisclosureMonitoring: refresh throws → swallowed, no rethrow", async () => {
  await runDisclosureMonitoring(makeRequest(), {
    triggerCheck: async () =>
      makeTriggeredResult({
        hasNewDisclosure: true,
        newDisclosureIds: ["20260525000001"],
      }),
    reportRefresh: async () => {
      throw new Error("backend 500");
    },
  });
});
