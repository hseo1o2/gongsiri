import type { ReportSummaryContract } from '@/lib/api/types'
import type { WatchlistItem } from '@/lib/types'
import type { DemoSessionState } from './types'

const SEEDED_WATCHLIST: WatchlistItem[] = [
  {
    corp_code: '00258801',
    corp_name: '카카오',
    stock_code: '035720',
    market: 'KOSPI',
    price: 42650,
    change_rate: 1.2,
    risk_level: 'caution',
    risk_score: 2,
    last_analyzed: '데모 시드',
  },
  {
    corp_code: '00126380',
    corp_name: '삼성전자',
    stock_code: '005930',
    market: 'KOSPI',
    price: 75400,
    change_rate: -0.5,
    risk_level: 'normal',
    risk_score: 0,
    last_analyzed: '데모 시드',
  },
]

const DEMO_COMPANY_CATALOG: WatchlistItem[] = [
  ...SEEDED_WATCHLIST,
  {
    corp_code: '00247540',
    corp_name: '에코프로비엠',
    stock_code: '247540',
    market: 'KOSDAQ',
    price: 128900,
    change_rate: 3.8,
    risk_level: 'normal',
    risk_score: 1,
    last_analyzed: '데모 후보',
  },
  {
    corp_code: '00068270',
    corp_name: '셀트리온',
    stock_code: '068270',
    market: 'KOSPI',
    price: 162000,
    change_rate: -1.1,
    risk_level: 'normal',
    risk_score: 1,
    last_analyzed: '데모 후보',
  },
]

const SEEDED_REPORTS: ReportSummaryContract[] = SEEDED_WATCHLIST.map(item => ({
  corpCode: item.corp_code,
  corpName: item.corp_name,
  analyzedAt: item.last_analyzed ?? '데모 시드',
  riskLevel: item.risk_level ?? 'normal',
  riskScore: item.risk_score ?? 0,
}))

function byCorpCode<T extends { corpCode?: string; corp_code?: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map(item => [item.corpCode ?? item.corp_code ?? '', item]))
}

export function createInitialDemoSessionState(): DemoSessionState {
  return {
    auth: {
      isAuthenticated: true,
      role: 'admin',
      displayName: '공시리 데모 관리자',
      onboardingComplete: true,
    },
    companyCatalog: DEMO_COMPANY_CATALOG,
    watchlistByCorpCode: byCorpCode(SEEDED_WATCHLIST),
    watchlistOrder: SEEDED_WATCHLIST.map(item => item.corp_code),
    addStatus: { state: 'idle', message: '' },
    lastManualCheck: null,
    reportSummariesByCorpCode: byCorpCode(SEEDED_REPORTS),
    reportDetailsByCorpCode: {},
  }
}
