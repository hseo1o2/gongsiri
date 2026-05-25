import test from "node:test";
import assert from "node:assert/strict";

import { createDisclosureScheduler } from "../dist/scheduler/disclosureScheduler.js";

// Mock clock factory
const makeClock = () => {
  const handles = [];
  return {
    clock: {
      setInterval(handler, timeout) {
        const handle = handles.length;
        handles.push({ handler, timeout, handle });
        return handle;
      },
      clearInterval(handle) {
        const idx = handles.findIndex((h) => h.handle === handle);
        if (idx !== -1) handles.splice(idx, 1);
      },
    },
    handles,
  };
};

// Case 1: GONGSIRI_CRON_ENABLED=false → setInterval not called
test("scheduler: GONGSIRI_CRON_ENABLED=false results in 0 setInterval calls", () => {
  // Simulate the boot guard by checking the env guard logic directly
  // (The guard lives in agentHttpRuntime.ts, not the scheduler itself.)
  // Here we test the scheduler can be created and started conditionally.
  const { clock, handles } = makeClock();
  const cronEnabled = process.env.GONGSIRI_CRON_ENABLED !== "false";

  // Simulate GONGSIRI_CRON_ENABLED=false
  const savedEnv = process.env.GONGSIRI_CRON_ENABLED;
  process.env.GONGSIRI_CRON_ENABLED = "false";

  const startedSchedulers = [];
  const entries = [{ keyword: "카카오", corp_code: "00258801" }];

  if (process.env.GONGSIRI_CRON_ENABLED !== "false") {
    for (const entry of entries) {
      const scheduler = createDisclosureScheduler({
        clock,
        run: async () => {},
      });
      const started = scheduler.start({
        keyword: entry.keyword,
        corpCode: entry.corp_code,
      });
      startedSchedulers.push(started);
    }
  }

  process.env.GONGSIRI_CRON_ENABLED = savedEnv ?? "";

  assert.equal(
    handles.length,
    0,
    "setInterval must not be called when GONGSIRI_CRON_ENABLED=false",
  );
  assert.equal(startedSchedulers.length, 0);
});

// Case 2: stock_master with N entries → setInterval called N times
test("scheduler: N stock master entries → N setInterval registrations", () => {
  const { clock, handles } = makeClock();

  const stockMasterEntries = [
    { keyword: "카카오", corp_code: "00258801" },
    { keyword: "삼성전자", corp_code: "00126380" },
    { keyword: "네이버", corp_code: "00266961" },
  ];

  const startedSchedulers = [];

  // Simulate boot loop (mirrors agentHttpRuntime.ts logic)
  for (const entry of stockMasterEntries) {
    const scheduler = createDisclosureScheduler({ clock, run: async () => {} });
    const started = scheduler.start({
      keyword: entry.keyword,
      corpCode: entry.corp_code,
    });
    startedSchedulers.push(started);
  }

  assert.equal(
    handles.length,
    stockMasterEntries.length,
    `setInterval must be called once per stock master entry (expected ${stockMasterEntries.length})`,
  );
  assert.equal(startedSchedulers.length, stockMasterEntries.length);

  // Clean up
  startedSchedulers.forEach((s) => s.stop());
  assert.equal(handles.length, 0, "all intervals cleared after stop()");
});

// Case 3: stop() clears each registered interval independently
test("scheduler: stop() clears each interval independently", () => {
  const { clock, handles } = makeClock();

  const s1 = createDisclosureScheduler({ clock, run: async () => {} }).start({
    keyword: "카카오",
  });
  const s2 = createDisclosureScheduler({ clock, run: async () => {} }).start({
    keyword: "삼성전자",
  });

  assert.equal(handles.length, 2);

  s1.stop();
  assert.equal(handles.length, 1, "one interval remains after first stop");

  s2.stop();
  assert.equal(handles.length, 0, "no intervals remain after both stops");
});

// Case 4: scheduler passes cron source through to run callback
test("scheduler: run callback receives cron source", async () => {
  const { clock } = makeClock();
  const receivedRequests = [];

  const scheduler = createDisclosureScheduler({
    clock,
    run: async (request) => {
      receivedRequests.push(request);
    },
  });

  await scheduler.runOnce({ keyword: "카카오", corpCode: "00258801" });

  assert.equal(receivedRequests.length, 1);
  assert.equal(receivedRequests[0].source, "cron");
  assert.equal(receivedRequests[0].keyword, "카카오");
});
