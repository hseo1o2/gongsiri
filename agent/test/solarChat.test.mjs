import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { createSolarChatTool } from "../dist/tools/chatWithSolar.js";

const makeExecutable = (name, body) => {
  const dir = mkdtempSync(join(tmpdir(), "gongsiri-solar-"));
  const scriptPath = join(dir, name);
  writeFileSync(scriptPath, body, { encoding: "utf-8" });
  chmodSync(scriptPath, 0o755);

  return {
    scriptPath,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
};

test("solar chat returns typed missing_env when key is absent", async () => {
  const result = await createSolarChatTool({ env: { UPSTAGE_API_KEY: undefined } }).invoke({
    prompt: "hello",
    traceId: "missing-env-trace",
    contractVersion: "v1"
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "missing_env");
  assert.equal(result.traceId, "missing-env-trace");
});

test("solar chat parses successful typed output", async () => {
  const { scriptPath, cleanup } = makeExecutable(
    "python-success.sh",
    `#!/bin/sh
printf '%s\n' '{"ok":true,"traceId":"solar-trace","contractVersion":"v1","observedAt":"2026-05-21T00:00:00Z","model":"solar-pro3","text":"SOLAR_LIVE_OK"}'
`
  );

  try {
    const result = await createSolarChatTool({ pythonBin: scriptPath }).invoke({
      prompt: "say ok",
      traceId: "solar-trace",
      contractVersion: "v1"
    });

    assert.equal(result.ok, true);
    assert.equal(result.text, "SOLAR_LIVE_OK");
    assert.equal(result.model, "solar-pro3");
  } finally {
    cleanup();
  }
});

test("solar chat maps malformed output", async () => {
  const { scriptPath, cleanup } = makeExecutable(
    "python-malformed.sh",
    `#!/bin/sh
printf '%s\n' 'not-json'
`
  );

  try {
    const result = await createSolarChatTool({ pythonBin: scriptPath }).invoke({
      prompt: "say ok",
      traceId: "solar-bad",
      contractVersion: "v1"
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "solar_malformed_output");
  } finally {
    cleanup();
  }
});

test("solar chat CLI emits typed envelope", () => {
  const { scriptPath, cleanup } = makeExecutable(
    "python-success.sh",
    `#!/bin/sh
printf '%s\n' '{"ok":true,"traceId":"cli-solar-trace","contractVersion":"v1","observedAt":"2026-05-21T00:00:00Z","model":"solar-pro3","text":"SOLAR_LIVE_OK"}'
`
  );

  try {
    const result = spawnSync(
      "node",
      ["dist/cli/runSolarChat.js", "--prompt", "Reply exactly SOLAR_LIVE_OK", "--trace-id", "cli-solar-trace"],
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: {
          ...process.env,
          PYTHON_BIN: scriptPath,
          UPSTAGE_API_KEY: "dummy"
        }
      }
    );

    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.text, "SOLAR_LIVE_OK");
  } finally {
    cleanup();
  }
});

test("solar chat CLI can read credentials from a local env file", () => {
  const dir = mkdtempSync(join(tmpdir(), "gongsiri-solar-env-"));
  const envFile = join(dir, ".env");
  writeFileSync(envFile, "UPSTAGE_API_KEY=dummy-from-env-file\nUPSTAGE_MODEL=solar-pro3\n", "utf-8");
  const { scriptPath, cleanup } = makeExecutable(
    "python-success.sh",
    `#!/bin/sh
printf '%s\n' '{"ok":true,"traceId":"env-file-trace","contractVersion":"v1","observedAt":"2026-05-21T00:00:00Z","model":"solar-pro3","text":"SOLAR_LIVE_OK"}'
`
  );

  try {
    const result = spawnSync(
      "node",
      ["dist/cli/runSolarChat.js", "--prompt", "Reply exactly SOLAR_LIVE_OK", "--trace-id", "env-file-trace"],
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: {
          ...process.env,
          GONGSIRI_ENV_FILE: envFile,
          PYTHON_BIN: scriptPath,
          UPSTAGE_API_KEY: ""
        }
      }
    );

    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout.trim());
    assert.equal(parsed.ok, true);
    assert.equal(parsed.traceId, "env-file-trace");
  } finally {
    cleanup();
    rmSync(dir, { recursive: true, force: true });
  }
});
