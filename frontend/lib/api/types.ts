export type ReportView = 'report-list' | 'report-detail' | 'manual-check'
export type RiskLevel = 'normal' | 'caution' | 'high'
export type ChecklistStatus = 'pass' | 'fail' | 'unknown'
export type FallbackReason =
  | 'cold_start_no_cached_reports'
  | 'cold_start_generated_detail'
  | 'read_only_manual_check'

export interface FallbackInfo {
  used: boolean
  reason?: FallbackReason
}

export interface ChecklistItemContract {
  id: string
  title: string
  status: ChecklistStatus
  score: number
  reason: string
  evidence: string[]
}

export interface ReportSummaryContract {
  corpCode: string
  corpName: string
  analyzedAt: string
  riskLevel: RiskLevel
  riskScore: number
}

export interface ReportDetailContract extends ReportSummaryContract {
  checklist: ChecklistItemContract[]
  shortTermReport: string
  longTermReport?: string
  disclaimer: string
  missingEvidence: string[]
}

export interface ReportListRequest {
  view: 'report-list'
  corpCodes?: string[]
}

export interface ReportDetailRequest {
  view: 'report-detail'
  corpCode: string
}

export interface ManualCheckRequest {
  view: 'manual-check'
  corpCodes: string[]
}

export type ReportsRequest = ReportListRequest | ReportDetailRequest | ManualCheckRequest

export interface ReportListResponse {
  view: 'report-list'
  reports: ReportSummaryContract[]
  fallback: FallbackInfo
}

export interface ReportDetailResponse {
  view: 'report-detail'
  report: ReportDetailContract
  fallback: FallbackInfo
}

export interface ManualCheckResponse {
  view: 'manual-check'
  acceptedCorpCodes: string[]
  maxBatchSize: 20
  fallback: FallbackInfo
}

export type ReportsErrorCode =
  | 'invalid_request'
  | 'batch_limit_exceeded'
  | 'reports_route_failed'
  | 'agent_unavailable'
  | 'agent_malformed_response'
  | 'agent_http_error'
  | 'missing_env'
  | 'pi_agent_error'
  | 'corp_code_unresolved'
  | 'analysis_failed'

export interface ReportsErrorResponse {
  ok: false
  triggerSource?: string
  traceId: string
  contractVersion: 'v1'
  observedAt: string
  error: {
    code: ReportsErrorCode
    message: string
  }
  evidence: Record<string, unknown>[]
}

export type ReportsResponse =
  | ReportListResponse
  | ReportDetailResponse
  | ManualCheckResponse
  | ReportsErrorResponse
