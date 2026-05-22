export type RiskLevel = 'normal' | 'caution' | 'high'
export type ChecklistStatus = 'pass' | 'fail' | 'unknown'

export interface ChecklistItem {
  id: string
  title: string
  status: ChecklistStatus
  score: number
  reason: string
  evidence: string[]
  evidenceRefs?: Array<{
    label: string
    source: string
    observedAt?: string | null
  }>
  source?: string
  observedAt?: string | null
  solar_explanation: string
}

export interface AnalysisResult {
  risk_score: number
  risk_level: RiskLevel
  checklist: ChecklistItem[]
  short_term_report: string
  long_term_report: string
  disclaimer: string
  missing_evidence: string[]
}

export interface CompanyInfo {
  corp_name: string
  stock_code: string
  corp_code?: string
  market?: string
}

export interface WatchlistItem {
  corp_code: string
  corp_name: string
  stock_code: string
  market: string
  price?: number
  change_rate?: number
  risk_level?: RiskLevel
  risk_score?: number
  last_analyzed?: string
}

export interface DisclosureAlert {
  id: string
  corp_name: string
  risk_level: RiskLevel | 'info'
  title: string
  description: string
  time: string
}

export interface PortfolioItem {
  corp_code: string
  corp_name: string
  stock_code: string
  quantity: number
  avg_price: number
  risk_level?: RiskLevel
  risk_score?: number
}

export interface AgentStatus {
  is_running: boolean
  monitored_count: number
  next_poll_seconds: number
}
