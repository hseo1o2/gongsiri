import type { ReportDetailContract, ReportSummaryContract, RiskLevel } from '@/lib/api/types'
import type { WatchlistItem } from '@/lib/types'

export type DemoUserRole = 'admin' | 'user'

export interface DemoAuthState {
  isAuthenticated: boolean
  role: DemoUserRole
  displayName: string
  onboardingComplete: boolean
}

export interface DemoAddStatus {
  state: 'idle' | 'added' | 'duplicate' | 'not-found'
  message: string
  corpCode?: string
}

export interface DemoManualCheckSnapshot {
  requestedAt: string
  acceptedCorpCodes: string[]
  maxBatchSize: 20
}

export interface DemoSessionState {
  auth: DemoAuthState
  companyCatalog: WatchlistItem[]
  watchlistByCorpCode: Record<string, WatchlistItem>
  watchlistOrder: string[]
  addStatus: DemoAddStatus
  lastManualCheck: DemoManualCheckSnapshot | null
  reportSummariesByCorpCode: Record<string, ReportSummaryContract>
  reportDetailsByCorpCode: Record<string, ReportDetailContract>
}

export interface DemoDashboardSummary {
  count: number
  todayDisclosures: number
  cautionCount: number
  dangerCount: number
}

export interface DemoQaStockOption {
  corp_code: string
  corp_name: string
  risk_level: RiskLevel
}

export type DemoSessionAction =
  | { type: 'watchlist/add'; item: WatchlistItem }
  | { type: 'watchlist/remove'; corpCode: string }
  | { type: 'watchlist/notFound'; query: string }
  | { type: 'manualCheck/record'; snapshot: DemoManualCheckSnapshot }
  | { type: 'reports/upsertSummary'; summary: ReportSummaryContract }
  | { type: 'reports/upsertDetail'; detail: ReportDetailContract }
  | { type: 'session/reset' }
