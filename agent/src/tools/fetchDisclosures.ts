import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { FetchDisclosuresRequest } from "../contracts/request.js";
import type { ToolDefinition } from "../contracts/tool.js";
import { fetchDisclosuresToolDescriptor } from "../contracts/tool.js";
import type { ToolResult, ToolResultFailure } from "../contracts/response.js";
import { resolveContractVersion } from "../session/session.js";

type ExecFileLike = typeof execFile;

type CreateFetchDisclosuresToolOptions = {
  pythonBin?: string;
  repoRoot?: string;
  env?: Record<string, string | undefined>;
  execFileImpl?: ExecFileLike;
};

const BRIDGE_ARGS = ["-m", "backend.collector.cli.fetch_disclosures"] as const;
const DEFAULT_CONTRACT_VERSION = "v1" as const;
const DEFAULT_REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DEFAULT_TRACE_ID = "pi-bootstrap-trace";

const buildFailure = (
  code: ToolResultFailure["error"]["code"],
  message: string,
  traceId: string,
  contractVersion: "v1"
): ToolResultFailure => ({
  ok: false,
  traceId,
  contractVersion,
  observedAt: new Date().toISOString(),
  error: {
    code,
    message
  },
  evidence: []
});

const resolveRequestContractVersion = (request: FetchDisclosuresRequest): "v1" =>
  request.contractVersion ?? resolveContractVersion() ?? DEFAULT_CONTRACT_VERSION;

const isToolResult = (value: unknown): value is ToolResult => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.ok !== "boolean" ||
    typeof candidate.traceId !== "string" ||
    typeof candidate.contractVersion !== "string" ||
    typeof candidate.observedAt !== "string" ||
    !Array.isArray(candidate.evidence)
  ) {
    return false;
  }

  if (candidate.ok) {
    return Boolean(candidate.data && typeof candidate.data === "object");
  }

  return Boolean(
    candidate.error &&
      typeof candidate.error === "object" &&
      typeof (candidate.error as Record<string, unknown>).code === "string" &&
      typeof (candidate.error as Record<string, unknown>).message === "string"
  );
};

const runExecFile = async (
  execFileImpl: ExecFileLike,
  pythonBin: string,
  args: string[],
  env: Record<string, string | undefined>,
  cwd: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> =>
  new Promise((resolve) => {
    execFileImpl(
      pythonBin,
      args,
      {
        cwd,
        env,
        maxBuffer: 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            exitCode: typeof error.code === "number" ? error.code : 1,
            stdout,
            stderr
          });
          return;
        }

        resolve({
          exitCode: 0,
          stdout,
          stderr
        });
      }
    );
  });

export const createFetchDisclosuresTool = (
  options: CreateFetchDisclosuresToolOptions = {}
): ToolDefinition => ({
  descriptor: fetchDisclosuresToolDescriptor,
  async invoke(request: FetchDisclosuresRequest): Promise<ToolResult> {
    const traceId = request.traceId ?? DEFAULT_TRACE_ID;
    const contractVersion = resolveRequestContractVersion(request);
    const pythonBin = options.pythonBin ?? process.env.PYTHON_BIN ?? "python3";
    const cwd = options.repoRoot ?? DEFAULT_REPO_ROOT;
    const env = {
      ...process.env,
      ...options.env
    };
    const payload = {
      ...request,
      traceId,
      contractVersion
    };

    const { exitCode, stdout, stderr } = await runExecFile(
      options.execFileImpl ?? execFile,
      pythonBin,
      [...BRIDGE_ARGS, "--input", JSON.stringify(payload)],
      env,
      cwd
    );

    const raw = stdout.trim();

    if (!raw) {
      return buildFailure(
        "bridge_process_failed",
        `Bridge exited with code ${exitCode}${stderr ? `: ${stderr.trim()}` : ""}`,
        traceId,
        contractVersion
      );
    }

    try {
      const parsed = JSON.parse(raw);

      if (isToolResult(parsed)) {
        return parsed;
      }

      return buildFailure(
        exitCode === 0 ? "bridge_malformed_output" : "bridge_process_failed",
        "Bridge stdout did not match the ToolResult contract.",
        traceId,
        contractVersion
      );
    } catch (error) {
      return buildFailure(
        "bridge_malformed_output",
        error instanceof Error ? error.message : "Bridge stdout JSON 파싱에 실패했습니다.",
        traceId,
        contractVersion
      );
    }
  }
});

export const fetchDisclosuresTool = createFetchDisclosuresTool();
