import type { AnalysisResult, ChecklistItem } from "@/lib/types";
import type {
  ChecklistItemContract,
  ManualCheckResponse,
  ReportDetailResponse,
  ReportListResponse,
  ReportsRequest,
  ReportsResponse,
} from "./types";

const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const MANUAL_CHECK_BATCH_MAX = 20;

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getBackendReportsEndpoint(
  baseUrl: string = DEFAULT_API_BASE_URL,
): string {
  return `${trimTrailingSlash(baseUrl)}/api/v1/reports`;
}

export function getReportsEndpoint(baseUrl?: string): string {
  if (baseUrl) {
    return getBackendReportsEndpoint(baseUrl);
  }

  return typeof window === "undefined"
    ? getBackendReportsEndpoint()
    : "/api/v1/reports";
}

export async function postReports(
  body: ReportsRequest,
  init?: Omit<RequestInit, "method" | "body">,
): Promise<ReportsResponse> {
  const response = await fetch(getReportsEndpoint(), {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });

  return (await response.json()) as ReportsResponse;
}

export async function fetchReportList(
  corpCodes?: string[],
): Promise<ReportListResponse> {
  const payload = await postReports(
    {
      view: "report-list",
      ...(corpCodes ? { corpCodes } : {}),
    },
    { cache: "no-store" },
  );

  if (isFailureEnvelope(payload)) {
    throw new Error(
      payload.error?.message ??
        "저 공시리가 리포트 목록을 불러오지 못했습니다.",
    );
  }
  if (!isReportListResponse(payload)) {
    throw new Error("저 공시리가 리포트 목록 응답 형식을 확인하지 못했습니다.");
  }

  return payload;
}

export async function fetchReportDetail(
  corpCode: string,
  forceRefresh = false,
): Promise<ReportDetailResponse> {
  const payload = await postReports(
    {
      view: "report-detail",
      corpCode,
      ...(forceRefresh ? { forceRefresh: true } : {}),
    },
    { cache: "no-store" },
  );

  if (isTypedReportDetailResponse(payload)) {
    return payload;
  }

  if (isFailureEnvelope(payload)) {
    throw new Error(
      payload.error?.message ??
        "저 공시리가 리포트 상세를 불러오지 못했습니다.",
    );
  }

  throw new Error("저 공시리가 리포트 상세 응답 형식을 확인하지 못했습니다.");
}

export async function postManualCheck(
  corpCodes: string[],
): Promise<ManualCheckResponse> {
  if (corpCodes.length > MANUAL_CHECK_BATCH_MAX) {
    throw new Error(
      `manual-check supports at most ${MANUAL_CHECK_BATCH_MAX} corp codes per request`,
    );
  }

  return (await postReports({
    view: "manual-check",
    corpCodes,
  })) as ManualCheckResponse;
}

export interface ReportDetailViewModel {
  corpCode: string;
  corpName: string;
  analyzedAt: string;
  result: AnalysisResult;
  fallback: {
    used: boolean;
    reason?: string;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReportListResponse(payload: unknown): payload is ReportListResponse {
  return (
    isObject(payload) &&
    payload.view === "report-list" &&
    Array.isArray(payload.reports) &&
    isObject(payload.fallback)
  );
}

function isTypedReportDetailResponse(
  payload: unknown,
): payload is ReportDetailResponse {
  return (
    isObject(payload) &&
    payload.view === "report-detail" &&
    isObject(payload.report)
  );
}

function isFailureEnvelope(
  payload: unknown,
): payload is { ok: false; error?: { message?: string } } {
  return isObject(payload) && payload.ok === false;
}

// checklist.py build_checklist() 의 표준 6개 항목 — 백엔드 진실의 출처와 동기화 유지
const STANDARD_CHECKLIST_STUBS: ReadonlyArray<{ id: string; title: string }> = [
  { id: "business-purpose-change", title: "사업목적 전환 이력" },
  { id: "hot-theme-following", title: "핫 테마 후행 참여" },
  {
    id: "capital-structure-change",
    title: "주식 구조 변경 + 신사업 동시 발생",
  },
  { id: "abnormal-price-surge", title: "비정상 주가 급등" },
  { id: "risky-history", title: "관리종목·CB·감자·최대주주 변경 이력" },
  { id: "performance-divergence", title: "실적 없는 급등 / 실적 괴리" },
];

function normalizeChecklist(
  items: ChecklistItemContract[] | ChecklistItem[],
): ChecklistItem[] {
  const mapped: ChecklistItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    score: item.score,
    reason: item.reason,
    evidence: item.evidence,
    evidenceRefs: item.evidenceRefs,
    source: item.source,
    observedAt: item.observedAt,
    solar_explanation:
      "solar_explanation" in item
        ? (item.solar_explanation ?? item.reason)
        : (item.explanationMarkdown ?? item.reason),
  }));

  // 방어적 패딩: 백엔드가 6개를 보장하지 못한 경우를 대비해 누락 항목을 채운다
  const presentIds = new Set(mapped.map((item) => item.id));
  const order = new Map(STANDARD_CHECKLIST_STUBS.map((s, i) => [s.id, i]));

  for (const stub of STANDARD_CHECKLIST_STUBS) {
    if (!presentIds.has(stub.id)) {
      mapped.push({
        id: stub.id,
        title: stub.title,
        status: "unknown",
        score: 0,
        reason: "분석 근거가 없습니다.",
        evidence: [],
        evidenceRefs: [],
        source: "deterministic_backend",
        observedAt: undefined,
        solar_explanation: "",
      });
    }
  }

  // 표준 순서대로 정렬
  mapped.sort((a, b) => {
    const ai = order.get(a.id) ?? STANDARD_CHECKLIST_STUBS.length;
    const bi = order.get(b.id) ?? STANDARD_CHECKLIST_STUBS.length;
    return ai - bi;
  });

  return mapped;
}

export async function fetchReportDetailViewModel(
  corpCode: string,
  forceRefresh = false,
): Promise<ReportDetailViewModel> {
  const payload = (await postReports(
    {
      view: "report-detail",
      corpCode,
      ...(forceRefresh ? { forceRefresh: true } : {}),
    },
    { cache: "no-store" },
  )) as unknown;

  if (isTypedReportDetailResponse(payload)) {
    return {
      corpCode: payload.report.corpCode,
      corpName: payload.report.corpName,
      analyzedAt: payload.report.analyzedAt,
      result: {
        risk_score: payload.report.riskScore,
        risk_level: payload.report.riskLevel,
        checklist: normalizeChecklist(payload.report.checklist),
        short_term_report: payload.report.shortTermReport,
        long_term_report: payload.report.longTermReport ?? "",
        disclaimer: payload.report.disclaimer,
        missing_evidence: payload.report.missingEvidence,
      },
      fallback: payload.fallback,
    };
  }

  if (isFailureEnvelope(payload)) {
    throw new Error(
      payload.error?.message ??
        "저 공시리가 리포트 상세를 불러오지 못했습니다.",
    );
  }

  throw new Error("저 공시리가 리포트 상세 응답 형식을 확인하지 못했습니다.");
}

export { MANUAL_CHECK_BATCH_MAX };
