import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { PipelineResult, PipelineResultFailure, PipelineTriggerRequest } from "../contracts/pipeline.js";
import { RUN_ANALYSIS_PIPELINE_TOOL_NAME } from "../contracts/pipeline.js";

type ExecFileLike = typeof execFile;

type CreateRunAnalysisPipelineToolOptions = {
  pythonBin?: string;
  repoRoot?: string;
  env?: Record<string, string | undefined>;
  execFileImpl?: ExecFileLike;
};

export type PipelineToolDefinition = {
  descriptor: {
    name: typeof RUN_ANALYSIS_PIPELINE_TOOL_NAME;
    description: string;
    canonicalCommand: "python -m backend.analyzer.cli.run_pipeline";
  };
  invoke(request: PipelineTriggerRequest): Promise<PipelineResult>;
};

const PIPELINE_ARGS = ["-m", "backend.analyzer.cli.run_pipeline"] as const;
const DEFAULT_CONTRACT_VERSION = "v1" as const;
const DEFAULT_REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const buildFailure = (
  code: string,
  message: string,
  request: PipelineTriggerRequest
): PipelineResultFailure => ({
  ok: false,
  triggerSource: request.source,
  traceId: request.traceId ?? "pipeline-trace",
  contractVersion: request.contractVersion ?? DEFAULT_CONTRACT_VERSION,
  observedAt: new Date().toISOString(),
  error: { code, message },
  evidence: []
});

const isPipelineResult = (value: unknown): value is PipelineResult => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.ok === "boolean" &&
    typeof candidate.triggerSource === "string" &&
    typeof candidate.traceId === "string" &&
    typeof candidate.contractVersion === "string" &&
    typeof candidate.observedAt === "string" &&
    Array.isArray(candidate.evidence)
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

        resolve({ exitCode: 0, stdout, stderr });
      }
    );
  });

export const runAnalysisPipelineToolDescriptor: PipelineToolDefinition["descriptor"] = {
  name: RUN_ANALYSIS_PIPELINE_TOOL_NAME,
  description: "Normalize -> analyze pipeline bridge for the Pi pipeline milestone.",
  canonicalCommand: "python -m backend.analyzer.cli.run_pipeline"
};

export const createRunAnalysisPipelineTool = (
  options: CreateRunAnalysisPipelineToolOptions = {}
): PipelineToolDefinition => ({
  descriptor: runAnalysisPipelineToolDescriptor,
  async invoke(request: PipelineTriggerRequest): Promise<PipelineResult> {
    const pythonBin = options.pythonBin ?? process.env.PYTHON_BIN ?? "python3";
    const cwd = options.repoRoot ?? DEFAULT_REPO_ROOT;
    const env = {
      ...process.env,
      ...options.env
    };
    const payload = {
      ...request,
      contractVersion: request.contractVersion ?? DEFAULT_CONTRACT_VERSION
    };

    const { exitCode, stdout, stderr } = await runExecFile(
      options.execFileImpl ?? execFile,
      pythonBin,
      [...PIPELINE_ARGS, "--input", JSON.stringify(payload)],
      env,
      cwd
    );

    const raw = stdout.trim();

    if (!raw) {
      return buildFailure(
        "pipeline_process_failed",
        `Pipeline exited with code ${exitCode}${stderr ? `: ${stderr.trim()}` : ""}`,
        request
      );
    }

    try {
      const parsed = JSON.parse(raw);
      if (isPipelineResult(parsed)) {
        return parsed;
      }

      return buildFailure(
        exitCode === 0 ? "pipeline_malformed_output" : "pipeline_process_failed",
        "Pipeline stdout did not match the pipeline result contract.",
        request
      );
    } catch (error) {
      return buildFailure(
        "pipeline_malformed_output",
        error instanceof Error ? error.message : "Pipeline stdout JSON 파싱에 실패했습니다.",
        request
      );
    }
  }
});

export const runAnalysisPipelineTool = createRunAnalysisPipelineTool();
