import type {
  DisclosureTriggerInput,
  DisclosureTriggerRequest,
} from "../contracts/request.js";
import type { TriggeredDisclosureResult } from "../contracts/response.js";
import {
  createDisclosureTriggerRequest,
  runTriggeredDisclosureCheck,
} from "../triggers/disclosureTrigger.js";

type SchedulerClock = {
  setInterval(handler: () => void, timeout?: number): number;
  clearInterval(handle?: number): void;
};

type SchedulerStartResult = {
  intervalMs: number;
  stop(): void;
};

const DEFAULT_SCHEDULER_INTERVAL_MINUTES = Number(
  process.env.GONGSIRI_SCHEDULER_INTERVAL_MINUTES ?? "30",
);

export const resolveSchedulerIntervalMinutes = (): number =>
  Number.isFinite(DEFAULT_SCHEDULER_INTERVAL_MINUTES) &&
  DEFAULT_SCHEDULER_INTERVAL_MINUTES > 0
    ? DEFAULT_SCHEDULER_INTERVAL_MINUTES
    : 30;

export const createDisclosureScheduler = (
  options: {
    clock?: SchedulerClock;
    run?: (
      request: DisclosureTriggerRequest,
    ) => Promise<TriggeredDisclosureResult | void>;
  } = {},
) => {
  const clock = options.clock ?? { setInterval, clearInterval };
  const run = options.run ?? runTriggeredDisclosureCheck;

  const buildCronRequest = (input: Omit<DisclosureTriggerInput, "source">) =>
    createDisclosureTriggerRequest({
      ...input,
      source: "cron",
      intervalMinutes:
        input.intervalMinutes ?? resolveSchedulerIntervalMinutes(),
      runReason: input.runReason ?? "scheduled disclosure check",
    });

  return {
    async runOnce(
      input: Omit<DisclosureTriggerInput, "source">,
    ): Promise<TriggeredDisclosureResult | void> {
      return run(buildCronRequest(input));
    },
    start(input: Omit<DisclosureTriggerInput, "source">): SchedulerStartResult {
      const request = buildCronRequest(input);
      const intervalMs = (request.metadata?.intervalMinutes ?? 30) * 60 * 1000;
      const handle = clock.setInterval(() => {
        void run(request);
      }, intervalMs);

      return {
        intervalMs,
        stop: () => {
          clock.clearInterval(handle);
        },
      };
    },
  };
};
