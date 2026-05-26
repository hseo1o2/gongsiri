/**
 * Tests for agent/src/pi/qaSession.ts (via compiled dist).
 *
 * Run with:
 *   node --experimental-test-module-mocks --test test/qaSession.test.mjs
 *
 * Uses node:test mock.module (--experimental-test-module-mocks) to stub
 * createPiSession so no UPSTAGE_API_KEY or network calls are needed.
 *
 * Five behavioural properties:
 *  1. warm hit returns same session and increments turnCount
 *  2. miss with priorTurns assigns state.messages via Path A
 *  3. race guard serializes concurrent same-key calls
 *  4. LRU evicts oldest when size > MAX_WARM (100)
 *  5. idle TTL evicts stale entries on access
 *  6. getWarmSessionsStats shape matches /health contract
 */
import { mock, describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Stub factory
// ---------------------------------------------------------------------------

const makeFakeSession = () => {
  const state = { messages: [] };
  return {
    agent: { state },
    subscribe: () => () => {},
    async prompt() {},
    disposed: false,
    dispose() {
      this.disposed = true;
    },
  };
};

// ---------------------------------------------------------------------------
// Module mocks — must be registered before the module under test is imported
// ---------------------------------------------------------------------------

const piSessionModulePath = new URL("../dist/pi/piSession.js", import.meta.url)
  .pathname;
const agentPathsModulePath = new URL("../dist/agentPaths.js", import.meta.url)
  .pathname;

mock.module(piSessionModulePath, {
  namedExports: {
    DEFAULT_MODEL: "solar-pro3",
    PROVIDER: "upstage",
    requireApiKey: () => "fake-key",
    createRegistry: () => ({}),
    createPiSession: async (_opts) => makeFakeSession(),
    runPiSession: async () => ({ text: "stub", model: "upstage/solar-pro3" }),
  },
});

mock.module(agentPathsModulePath, {
  namedExports: {
    resolveAgentRoot: () => "/tmp/gongsiri-test",
  },
});

// Now import the module under test (after mocks are registered)
const { getOrCreateQaSession, releaseQaSession, getWarmSessionsStats } =
  await import("../dist/pi/qaSession.js");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("qaSession", () => {
  // Test 1 — warm hit returns same session and increments turnCount
  it("warm hit returns same session and increments turnCount", async () => {
    const convKey = "test-warm-hit-" + Date.now() + Math.random();

    const entry1 = await getOrCreateQaSession(convKey, []);
    releaseQaSession(convKey); // simulates end of a turn

    const entry2 = await getOrCreateQaSession(convKey, []);

    assert.equal(
      entry1 === entry2,
      true,
      "should return same WarmEntry reference",
    );
    assert.equal(
      entry2.turnCount,
      1,
      "turnCount should be 1 after one release",
    );
  });

  // Test 2 — miss with priorTurns assigns state.messages via Path A
  it("miss with priorTurns assigns state.messages via Path A", async () => {
    const convKey = "test-path-a-" + Date.now() + Math.random();
    const priorTurns = [
      { question: "Q1", answer: "A1", askedAt: new Date().toISOString() },
      { question: "Q2", answer: "A2", askedAt: new Date().toISOString() },
    ];

    const entry = await getOrCreateQaSession(convKey, priorTurns);

    // Path A: session.agent.state.messages = priorTurns.flatMap(rowToAgentMessage)
    // 2 turns × 2 messages each = 4 messages
    assert.equal(
      entry.session.agent.state.messages.length,
      4,
      "should have 4 messages (2 user + 2 assistant) from 2 prior turns",
    );
    assert.equal(entry.session.agent.state.messages[0].role, "user");
    assert.equal(entry.session.agent.state.messages[1].role, "assistant");
  });

  // Test 3 — race guard serializes concurrent same-key calls
  it("race guard serializes concurrent same-key calls", async () => {
    const convKey = "test-race-" + Date.now() + Math.random();

    const entry1 = await getOrCreateQaSession(convKey, []);

    // Simulate an in-flight turn by setting entry.pending
    let resolvePending;
    const pendingPromise = new Promise((resolve) => {
      resolvePending = resolve;
    });
    entry1.pending = pendingPromise;

    // Second concurrent call — should wait for pending
    let entry2Resolved = false;
    const entry2Promise = getOrCreateQaSession(convKey, []).then((e) => {
      entry2Resolved = true;
      return e;
    });

    // Yield to microtask queue; entry2 should still be waiting
    await new Promise((r) => setImmediate(r));
    assert.equal(
      entry2Resolved,
      false,
      "second call should still be waiting on pending",
    );

    resolvePending();
    const entry2 = await entry2Promise;

    assert.equal(
      entry2Resolved,
      true,
      "second call should resolve after pending clears",
    );
    assert.equal(
      entry1 === entry2,
      true,
      "both calls should return the same entry",
    );
  });

  // Test 4 — LRU evicts oldest when size > MAX_WARM (100)
  it("LRU evicts oldest when size > MAX_WARM", async () => {
    // MAX_WARM = 100. Pre-fill up to 100 then overflow by 1.
    // Fill first so the map is at 99, then add the "oldest" entry as entry #100.
    const currentStats = getWarmSessionsStats();
    const needed = 99 - currentStats.size;
    for (let i = 0; i < needed; i++) {
      await getOrCreateQaSession(
        "lru-fill-" + i + "-" + Date.now() + "-" + Math.random(),
        [],
      );
    }

    // Add the entry that should be LRU-evicted: give it a lastUsedAt slightly in the past
    // but well within the 30-minute TTL (so idle-eviction does NOT remove it).
    const oldestKey = "lru-oldest-" + Date.now() + Math.random();
    const oldestEntry = await getOrCreateQaSession(oldestKey, []);
    // Use a timestamp 10 seconds in the past — within TTL but oldest in the map
    oldestEntry.lastUsedAt = Date.now() - 10_000;

    const statsBefore = getWarmSessionsStats();
    assert.ok(
      statsBefore.size >= 100,
      `map should be >=100 before overflow, got ${statsBefore.size}`,
    );
    assert.equal(
      oldestEntry.session.disposed,
      false,
      "oldest session should not yet be disposed",
    );

    // One more entry triggers LRU eviction of oldestKey
    await getOrCreateQaSession(
      "lru-overflow-" + Date.now() + Math.random(),
      [],
    );

    const statsAfter = getWarmSessionsStats();
    assert.ok(
      statsAfter.size <= 100,
      `size should be <=100 after LRU eviction, got ${statsAfter.size}`,
    );
    assert.equal(
      oldestEntry.session.disposed,
      true,
      "oldest session should be disposed after LRU eviction",
    );
  });

  // Test 5 — idle TTL evicts stale entries on next access
  it("idle TTL evicts stale entries on access", async () => {
    const convKey = "test-ttl-" + Date.now() + Math.random();

    const staleEntry = await getOrCreateQaSession(convKey, []);

    // Push lastUsedAt beyond IDLE_TTL_MS (30 min)
    const IDLE_TTL_MS = 30 * 60 * 1000;
    staleEntry.lastUsedAt = Date.now() - IDLE_TTL_MS - 1000;

    // Next call triggers evictExpiredAndLru which removes staleEntry, then creates a fresh one
    const freshEntry = await getOrCreateQaSession(convKey, []);

    assert.equal(
      staleEntry.session.disposed,
      true,
      "stale session should be disposed after TTL eviction",
    );
    assert.ok(
      freshEntry !== staleEntry,
      "a new entry should be created after eviction",
    );
  });

  // Test 6 — getWarmSessionsStats shape matches /health contract
  it("getWarmSessionsStats returns object matching /health warmSessions contract", () => {
    const stats = getWarmSessionsStats();

    assert.ok(typeof stats === "object" && stats !== null);
    assert.ok(typeof stats.size === "number", "stats.size should be a number");
    assert.ok(Array.isArray(stats.entries), "stats.entries should be an array");
    assert.equal(
      stats.size,
      stats.entries.length,
      "size should equal entries.length",
    );

    for (const e of stats.entries) {
      assert.ok(
        typeof e.convKeyHash === "string",
        "entry.convKeyHash should be a string",
      );
      assert.ok(
        typeof e.turnCount === "number",
        "entry.turnCount should be a number",
      );
      assert.ok(
        typeof e.lastUsedAt === "number",
        "entry.lastUsedAt should be a number",
      );
      assert.ok(
        typeof e.sessionStartedAt === "number",
        "entry.sessionStartedAt should be a number",
      );
    }
  });
});
