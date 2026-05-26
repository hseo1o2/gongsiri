const REPORTS_CLIENT_CONTRACT_VERSION = "v2";
const BACKEND_BASE_URL =
  process.env.AGENT_BACKEND_URL ?? "http://127.0.0.1:8000";
const REPORTS_ENDPOINT = `${BACKEND_BASE_URL}/api/v1/reports`;
const REQUEST_TIMEOUT_MS = 30_000;

export type ReportRefreshInput = {
  corpCode?: string;
  keyword?: string;
  traceId: string;
};

const doFetch = (payload: Record<string, unknown>): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(REPORTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timer);
  });
};

export const requestReportRefresh = async (
  input: ReportRefreshInput,
): Promise<void> => {
  const payload: Record<string, unknown> = {
    view: "report-detail",
    contractVersion: REPORTS_CLIENT_CONTRACT_VERSION,
    source: "cron",
    traceId: input.traceId,
    forceRefresh: true,
  };
  if (input.corpCode) payload.corpCode = input.corpCode;
  if (input.keyword) payload.keyword = input.keyword;

  const attempt = async (): Promise<boolean> => {
    try {
      const res = await doFetch(payload);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        process.stderr.write(
          `[reportsClient] POST /api/v1/reports failed: HTTP ${res.status} — ${body.slice(0, 200)}\n`,
        );
        return false;
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `[reportsClient] POST /api/v1/reports error: ${message}\n`,
      );
      return false;
    }
  };

  const ok = await attempt();
  if (!ok) {
    process.stderr.write(
      `[reportsClient] retrying POST /api/v1/reports (attempt 2)\n`,
    );
    await attempt();
  }
};

export const reportsClient = { requestRefresh: requestReportRefresh };
