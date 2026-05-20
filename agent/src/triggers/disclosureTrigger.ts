import type {
  DisclosureTriggerInput,
  DisclosureTriggerRequest,
  TriggerSource
} from "../contracts/request.js";
import type {
  ToolResultFailure,
  ToolResultSuccess,
  TriggerCheckpoint,
  TriggeredDisclosureResult
} from "../contracts/response.js";
import type { ToolDefinition } from "../contracts/tool.js";
import { fetchDisclosuresTool } from "../tools/fetchDisclosures.js";
import {
  LocalDisclosureCheckpointStore,
  resolveCheckpointPath
} from "../state/disclosureCheckpoint.js";

const VALID_SOURCES: TriggerSource[] = ["user", "system", "cron"];

const buildCheckpoint = (
  checkpointPath: string,
  previousLastSeen: string | null,
  currentLastSeen: string | null
): TriggerCheckpoint => ({
  checkpointPath,
  previousLastSeen,
  currentLastSeen
});

const buildFailureResult = (
  request: DisclosureTriggerRequest,
  result: ToolResultFailure,
  previousLastSeen: string | null,
  checkpointPath: string
): TriggeredDisclosureResult => ({
  ok: false,
  triggerSource: request.source,
  traceId: result.traceId,
  contractVersion: result.contractVersion,
  hasNewDisclosure: false,
  newDisclosureCount: 0,
  newDisclosureIds: [],
  checkpoint: buildCheckpoint(checkpointPath, previousLastSeen, previousLastSeen),
  result
});

const collectNewDisclosureIds = (
  disclosures: ToolResultSuccess["data"]["disclosures"],
  previousLastSeen: string | null
): string[] => {
  if (!previousLastSeen) {
    return [];
  }

  const newIds: string[] = [];

  for (const disclosure of disclosures) {
    if (disclosure.rcept_no === previousLastSeen) {
      break;
    }

    newIds.push(disclosure.rcept_no);
  }

  return newIds;
};

const resolveCurrentLastSeen = (result: ToolResultSuccess): string | null =>
  result.data.disclosures[0]?.rcept_no ?? null;

export const createDisclosureTriggerRequest = (
  input: DisclosureTriggerInput
): DisclosureTriggerRequest => {
  if (!VALID_SOURCES.includes(input.source)) {
    throw new Error(`지원하지 않는 trigger source 입니다: ${input.source}`);
  }

  if (!input.keyword && !input.corpCode) {
    throw new Error("trigger request에는 keyword 또는 corpCode가 필요합니다.");
  }

  const sharedFields = {
    source: input.source,
    traceId: input.traceId,
    contractVersion: input.contractVersion ?? "v1",
    metadata:
      input.intervalMinutes || input.runReason
        ? {
            intervalMinutes: input.intervalMinutes,
            runReason: input.runReason
          }
        : undefined
  };

  if (input.corpCode) {
    return {
      ...sharedFields,
      corpCode: input.corpCode,
      keyword: input.keyword
    };
  }

  return {
    ...sharedFields,
    keyword: input.keyword as string
  };
};

export const runTriggeredDisclosureCheck = async (
  request: DisclosureTriggerRequest,
  options: {
    tool?: ToolDefinition;
    checkpointStore?: LocalDisclosureCheckpointStore;
  } = {}
): Promise<TriggeredDisclosureResult> => {
  const tool = options.tool ?? fetchDisclosuresTool;
  const checkpointStore = options.checkpointStore ?? new LocalDisclosureCheckpointStore();
  const lookupKey = request.corpCode ?? request.keyword ?? "unknown";
  const previousLastSeen = checkpointStore.read(lookupKey);
  const result = await tool.invoke(request);

  if (!result.ok) {
    return buildFailureResult(request, result, previousLastSeen, checkpointStore.checkpointPath);
  }

  const currentLastSeen = resolveCurrentLastSeen(result);
  const newDisclosureIds = collectNewDisclosureIds(result.data.disclosures, previousLastSeen);
  const hasNewDisclosure = previousLastSeen ? newDisclosureIds.length > 0 : false;

  if (currentLastSeen) {
    checkpointStore.write(lookupKey, currentLastSeen);
  }

  return {
    ok: true,
    triggerSource: request.source,
    traceId: result.traceId,
    contractVersion: result.contractVersion,
    hasNewDisclosure,
    newDisclosureCount: newDisclosureIds.length,
    newDisclosureIds,
    checkpoint: buildCheckpoint(checkpointStore.checkpointPath, previousLastSeen, currentLastSeen),
    result
  };
};
