import * as nodePath from "node:path";
import { createHash } from "node:crypto";
import type { AgentQaPriorTurn } from "../contracts/agentService.js";
import { resolveAgentRoot } from "../agentPaths.js";
import {
  createPiSession,
  DEFAULT_MODEL,
  type PiSessionOptions,
  type PiSession,
  type PiRunResult,
} from "./piSession.js";

const IDLE_TTL_MS = 30 * 60 * 1000;
const MAX_WARM = 100;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WarmEntry = {
  session: PiSession & { agent: any };
  lastUsedAt: number;
  turnCount: number;
  sessionStartedAt: number;
  pending: Promise<void> | null;
};

const warmSessions = new Map<string, WarmEntry>();

export const rowToAgentMessage = (turn: AgentQaPriorTurn): unknown[] => {
  const now = Date.now();
  const ts = new Date(turn.askedAt).getTime() || now;
  const userMsg = {
    role: "user",
    content: turn.question,
    timestamp: ts,
  };
  const assistantMsg = {
    role: "assistant",
    content: [{ type: "text", text: turn.answer }],
    api: "openai-completions",
    provider: "upstage",
    model: process.env.UPSTAGE_MODEL?.trim() || DEFAULT_MODEL,
    usage: { inputTokens: 0, outputTokens: 0 },
    stopReason: "stop",
    timestamp: ts,
  };
  return [userMsg, assistantMsg];
};

const evictExpiredAndLru = (): void => {
  const now = Date.now();
  for (const [key, entry] of warmSessions) {
    if (entry.lastUsedAt + IDLE_TTL_MS < now) {
      console.log(`[qaSession] idle-evict convKey=${key}`);
      entry.session.dispose();
      warmSessions.delete(key);
    }
  }
  while (warmSessions.size >= MAX_WARM) {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;
    for (const [key, entry] of warmSessions) {
      if (entry.lastUsedAt < oldestTime) {
        oldestTime = entry.lastUsedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      console.log(`[qaSession] lru-evict convKey=${oldestKey}`);
      warmSessions.get(oldestKey)!.session.dispose();
      warmSessions.delete(oldestKey);
    } else {
      break;
    }
  }
};

const buildSessionOptions = (): PiSessionOptions => {
  const agentRoot = resolveAgentRoot();
  return {
    modelId: process.env.UPSTAGE_MODEL?.trim() || DEFAULT_MODEL,
    agentDir: nodePath.join(agentRoot, ".runtime", "pi"),
  };
};

export const getOrCreateQaSession = async (
  convKey: string,
  priorTurns: AgentQaPriorTurn[],
): Promise<WarmEntry> => {
  evictExpiredAndLru();

  const existing = warmSessions.get(convKey);
  if (existing) {
    if (existing.pending) {
      await existing.pending;
    }
    console.log(
      `[qaSession] hit convKey=${convKey} turnCount=${existing.turnCount}`,
    );
    return existing;
  }

  console.log(
    `[qaSession] cold replay convKey=${convKey} priorTurns=${priorTurns.length}`,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (await createPiSession(
    buildSessionOptions(),
  )) as PiSession & { agent: any };

  if (priorTurns.length > 0) {
    // Path A: SDK 0.75.4 AgentState exposes public setter `set messages(messages: AgentMessage[])`
    session.agent.state.messages = priorTurns.flatMap(rowToAgentMessage);
  }

  const entry: WarmEntry = {
    session,
    lastUsedAt: Date.now(),
    turnCount: 0,
    sessionStartedAt: Date.now(),
    pending: null,
  };
  warmSessions.set(convKey, entry);
  return entry;
};

export const releaseQaSession = (convKey: string): void => {
  const entry = warmSessions.get(convKey);
  if (entry) {
    entry.lastUsedAt = Date.now();
    entry.turnCount += 1;
    entry.pending = null;
  }
};

export const runQaTurn = async (
  convKey: string,
  prompt: string,
  priorTurns: AgentQaPriorTurn[],
): Promise<PiRunResult> => {
  const entry = await getOrCreateQaSession(convKey, priorTurns);

  let resolvePending!: () => void;
  const turnPromise = new Promise<void>((resolve) => {
    resolvePending = resolve;
  });
  entry.pending = turnPromise;

  let text = "";
  const unsubscribe = entry.session.subscribe((event: unknown) => {
    const candidate = event as {
      type?: string;
      assistantMessageEvent?: { type?: string; delta?: string };
    };
    if (
      candidate.type === "message_update" &&
      candidate.assistantMessageEvent?.type === "text_delta" &&
      candidate.assistantMessageEvent.delta
    ) {
      text += candidate.assistantMessageEvent.delta;
    }
  });

  try {
    await entry.session.prompt(prompt, { source: "rpc" });
    const finalText = text.trim();
    if (!finalText) {
      throw new Error("저 공시리가 답변 본문을 받지 못했습니다.");
    }
    const modelId = process.env.UPSTAGE_MODEL?.trim() || DEFAULT_MODEL;
    return { text: finalText, model: `upstage/${modelId}` };
  } finally {
    unsubscribe();
    resolvePending();
    releaseQaSession(convKey);
  }
};

export const getWarmSessionsStats = (): {
  size: number;
  entries: Array<{
    convKeyHash: string;
    turnCount: number;
    lastUsedAt: number;
    sessionStartedAt: number;
  }>;
} => {
  const entries = [];
  for (const [key, entry] of warmSessions) {
    entries.push({
      convKeyHash: createHash("sha256").update(key).digest("hex").slice(0, 8),
      turnCount: entry.turnCount,
      lastUsedAt: entry.lastUsedAt,
      sessionStartedAt: entry.sessionStartedAt,
    });
  }
  return { size: warmSessions.size, entries };
};

process.on("SIGTERM", () => {
  for (const entry of warmSessions.values()) {
    entry.session.dispose();
  }
  warmSessions.clear();
});

process.on("SIGINT", () => {
  for (const entry of warmSessions.values()) {
    entry.session.dispose();
  }
  warmSessions.clear();
});
