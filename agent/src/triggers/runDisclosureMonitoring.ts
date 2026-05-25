import type { DisclosureTriggerRequest } from "../contracts/request.js";
import { runTriggeredDisclosureCheck } from "./disclosureTrigger.js";
import { requestReportRefresh } from "../clients/reportsClient.js";

export type MonitoringDeps = {
  triggerCheck?: typeof runTriggeredDisclosureCheck;
  reportRefresh?: typeof requestReportRefresh;
};

export const runDisclosureMonitoring = async (
  request: DisclosureTriggerRequest,
  deps: MonitoringDeps = {},
): Promise<void> => {
  const doTrigger = deps.triggerCheck ?? runTriggeredDisclosureCheck;
  const doRefresh = deps.reportRefresh ?? requestReportRefresh;

  let triggerResult;
  try {
    triggerResult = await doTrigger(request);
  } catch (err) {
    process.stderr.write(
      `[monitoring] trigger failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return;
  }

  if (!triggerResult.ok || !triggerResult.hasNewDisclosure) {
    return;
  }

  const corpCode = triggerResult.result.data.corpCode;
  const keyword = request.keyword;
  const traceId = triggerResult.traceId;

  try {
    await doRefresh({ corpCode, keyword, traceId });
  } catch (err) {
    process.stderr.write(
      `[monitoring] report refresh failed for ${corpCode ?? keyword}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
};
