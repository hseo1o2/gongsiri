import type {
  DisclosureTriggerInput,
  DisclosureTriggerRequest,
  TriggerSource
} from "../contracts/request.js";
import type {
  ToolResultFailure,
  ToolResultSuccess,
  TriggeredDisclosureResult
} from "../contracts/response.js";
import type { ToolDefinition } from "../contracts/tool.js";
import { fetchDisclosuresTool } from "../tools/fetchDisclosures.js";
import {
  LocalDisclosureCheckpointStore,
  resolveCheckpointPath
} from "../state/disclosureCheckpoint.js";
import {
  buildCheckpoint,
  buildFailureResult,
  collectNewDisclosureIds,
  readPreviousLastSeen,
  resolveCanonicalCorpCode,
  resolveCurrentLastSeen,
  resolveRequestKey,
  VALID_SOURCES
} from "./disclosureTriggerSupport.js";


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
  const requestKey = resolveRequestKey(request);
  const fallbackPreviousLastSeen = requestKey ? checkpointStore.read(requestKey) : null;
  const result = await tool.invoke(request);

  if (!result.ok) {
    return buildFailureResult(
      request,
      result,
      fallbackPreviousLastSeen,
      checkpointStore.checkpointPath
    );
  }

  const canonicalKey = resolveCanonicalCorpCode(request, result);
  const { previousLastSeen, migratedFromRequestKey } = readPreviousLastSeen(
    checkpointStore,
    canonicalKey,
    requestKey
  );
  const currentLastSeen = resolveCurrentLastSeen(result);
  const newDisclosureIds = collectNewDisclosureIds(result.data.disclosures, previousLastSeen);
  const hasNewDisclosure = previousLastSeen ? newDisclosureIds.length > 0 : false;

  if (currentLastSeen) {
    checkpointStore.write(canonicalKey, currentLastSeen);

    if (migratedFromRequestKey && requestKey && requestKey !== canonicalKey) {
      checkpointStore.delete(requestKey);
    }
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
