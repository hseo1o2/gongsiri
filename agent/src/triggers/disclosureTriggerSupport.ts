import type { DisclosureTriggerRequest, TriggerSource } from "../contracts/request.js";
import type {
  ToolResultFailure,
  ToolResultSuccess,
  TriggerCheckpoint,
  TriggeredDisclosureResult
} from "../contracts/response.js";
import { LocalDisclosureCheckpointStore } from "../state/disclosureCheckpoint.js";

export const VALID_SOURCES: TriggerSource[] = ["user", "system", "cron"];

export const buildCheckpoint = (
  checkpointPath: string,
  previousLastSeen: string | null,
  currentLastSeen: string | null
): TriggerCheckpoint => ({ checkpointPath, previousLastSeen, currentLastSeen });

export const buildFailureResult = (
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

export const collectNewDisclosureIds = (
  disclosures: ToolResultSuccess["data"]["disclosures"],
  previousLastSeen: string | null
): string[] => {
  if (!previousLastSeen) return [];
  const newIds: string[] = [];
  for (const disclosure of disclosures) {
    if (disclosure.rcept_no === previousLastSeen) break;
    newIds.push(disclosure.rcept_no);
  }
  return newIds;
};

export const resolveCurrentLastSeen = (result: ToolResultSuccess): string | null =>
  result.data.disclosures[0]?.rcept_no ?? null;

export const resolveRequestKey = (request: DisclosureTriggerRequest): string | null =>
  request.corpCode ?? request.keyword ?? null;

export const resolveCanonicalCorpCode = (
  request: DisclosureTriggerRequest,
  result: ToolResultSuccess
): string => result.data.corpCode || request.corpCode || request.keyword || "unknown";

export const readPreviousLastSeen = (
  checkpointStore: LocalDisclosureCheckpointStore,
  canonicalKey: string,
  requestKey: string | null
): { previousLastSeen: string | null; migratedFromRequestKey: boolean } => {
  const canonicalCheckpoint = checkpointStore.read(canonicalKey);
  if (canonicalCheckpoint) {
    return { previousLastSeen: canonicalCheckpoint, migratedFromRequestKey: false };
  }
  if (requestKey && requestKey !== canonicalKey) {
    const legacyCheckpoint = checkpointStore.read(requestKey);
    if (legacyCheckpoint) {
      return { previousLastSeen: legacyCheckpoint, migratedFromRequestKey: true };
    }
  }
  return { previousLastSeen: null, migratedFromRequestKey: false };
};
