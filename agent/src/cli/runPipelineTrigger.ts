import { runAnalysisPipelineTool } from "../tools/runAnalysisPipeline.js";
import type { PipelineTriggerRequest } from "../contracts/pipeline.js";

type ParsedArgs = {
  source: "user" | "system" | "cron";
  keyword?: string;
  corpCode?: string;
  traceId?: string;
  intervalMinutes?: number;
  runReason?: string;
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = {
    source: "user"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--source":
        parsed.source = (next as ParsedArgs["source"]) ?? "user";
        index += 1;
        break;
      case "--keyword":
        parsed.keyword = next;
        index += 1;
        break;
      case "--corp-code":
        parsed.corpCode = next;
        index += 1;
        break;
      case "--trace-id":
        parsed.traceId = next;
        index += 1;
        break;
      case "--interval-minutes":
        parsed.intervalMinutes = Number(next);
        index += 1;
        break;
      case "--run-reason":
        parsed.runReason = next;
        index += 1;
        break;
      default:
        break;
    }
  }

  return parsed;
};

export const main = async (argv = process.argv.slice(2)): Promise<number> => {
  const parsed = parseArgs(argv);
  const request: PipelineTriggerRequest = {
    source: parsed.source,
    keyword: parsed.keyword,
    corpCode: parsed.corpCode,
    traceId: parsed.traceId,
    contractVersion: "v1",
    metadata:
      parsed.intervalMinutes || parsed.runReason
        ? {
            intervalMinutes: parsed.intervalMinutes,
            runReason: parsed.runReason
          }
        : undefined
  };

  const result = await runAnalysisPipelineTool.invoke(request);
  console.log(JSON.stringify(result));
  return result.ok ? 0 : 1;
};

if (process.argv[1]?.endsWith("runPipelineTrigger.js")) {
  main().then((code) => {
    process.exitCode = code;
  });
}
