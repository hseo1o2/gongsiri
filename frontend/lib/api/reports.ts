import type { AnalysisResult, ChecklistItem } from '@/lib/types'
import type {
  ChecklistItemContract,
  ManualCheckResponse,
  ReportDetailResponse,
  ReportListResponse,
  ReportsRequest,
  ReportsResponse,
} from './types'

const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
const MANUAL_CHECK_BATCH_MAX = 20

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

export function getBackendReportsEndpoint(baseUrl: string = DEFAULT_API_BASE_URL): string {
  return `${trimTrailingSlash(baseUrl)}/api/v1/reports`
}

export function getReportsEndpoint(baseUrl?: string): string {
  if (baseUrl) {
    return getBackendReportsEndpoint(baseUrl)
  }

  return typeof window === 'undefined' ? getBackendReportsEndpoint() : '/api/v1/reports'
}

export async function postReports(
  body: ReportsRequest,
  init?: Omit<RequestInit, 'method' | 'body'>,
): Promise<ReportsResponse> {
  const response = await fetch(getReportsEndpoint(), {
    ...init,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  })

  return (await response.json()) as ReportsResponse
}

export async function fetchReportList(corpCodes?: string[]): Promise<ReportListResponse> {
  const payload = await postReports({
    view: 'report-list',
    ...(corpCodes ? { corpCodes } : {}),
  }, { cache: 'no-store' })

  if (isFailureEnvelope(payload)) {
    throw new Error(payload.error?.message ?? '저 공시리가 리포트 목록을 불러오지 못했습니다.')
  }
  if (!isReportListResponse(payload)) {
    throw new Error('저 공시리가 리포트 목록 응답 형식을 확인하지 못했습니다.')
  }

  return payload
}

export async function fetchReportDetail(
  corpCode: string,
  forceRefresh = false,
): Promise<ReportDetailResponse> {
  const payload = await postReports({
    view: 'report-detail',
    corpCode,
    ...(forceRefresh ? { forceRefresh: true } : {}),
  }, { cache: 'no-store' })

  if (isTypedReportDetailResponse(payload)) {
    return payload
  }

  if (isFailureEnvelope(payload)) {
    throw new Error(payload.error?.message ?? '저 공시리가 리포트 상세를 불러오지 못했습니다.')
  }

  throw new Error('저 공시리가 리포트 상세 응답 형식을 확인하지 못했습니다.')
}

export async function postManualCheck(corpCodes: string[]): Promise<ManualCheckResponse> {
  if (corpCodes.length > MANUAL_CHECK_BATCH_MAX) {
    throw new Error(`manual-check supports at most ${MANUAL_CHECK_BATCH_MAX} corp codes per request`)
  }

  return (await postReports({
    view: 'manual-check',
    corpCodes,
  })) as ManualCheckResponse
}

export interface ReportDetailViewModel {
  corpCode: string
  corpName: string
  analyzedAt: string
  result: AnalysisResult
  fallback: {
    used: boolean
    reason?: string
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isReportListResponse(payload: unknown): payload is ReportListResponse {
  return isObject(payload) && payload.view === 'report-list' && Array.isArray(payload.reports) && isObject(payload.fallback)
}

function isTypedReportDetailResponse(payload: unknown): payload is ReportDetailResponse {
  return isObject(payload) && payload.view === 'report-detail' && isObject(payload.report)
}

function isFailureEnvelope(payload: unknown): payload is { ok: false; error?: { message?: string } } {
  return isObject(payload) && payload.ok === false
}

function normalizeChecklist(items: ChecklistItemContract[] | ChecklistItem[]): ChecklistItem[] {
  return items.map(item => ({
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
      'solar_explanation' in item
        ? (item.solar_explanation ?? item.reason)
        : (item.explanationMarkdown ?? item.reason),
  }))
}

export async function fetchReportDetailViewModel(
  corpCode: string,
  forceRefresh = false,
): Promise<ReportDetailViewModel> {
  const payload = await postReports(
    {
      view: 'report-detail',
      corpCode,
      ...(forceRefresh ? { forceRefresh: true } : {}),
    },
    { cache: 'no-store' },
  ) as unknown

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
        long_term_report: payload.report.longTermReport ?? '',
        disclaimer: payload.report.disclaimer,
        missing_evidence: payload.report.missingEvidence,
      },
      fallback: payload.fallback,
    }
  }

  if (isFailureEnvelope(payload)) {
    throw new Error(payload.error?.message ?? '저 공시리가 리포트 상세를 불러오지 못했습니다.')
  }

  throw new Error('저 공시리가 리포트 상세 응답 형식을 확인하지 못했습니다.')
}

export { MANUAL_CHECK_BATCH_MAX }
