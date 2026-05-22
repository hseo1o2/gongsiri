import type { WatchlistItem } from '@/lib/types'
import type { DemoSessionState } from './types'

const SEEDED_COMPANIES: WatchlistItem[] = [
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
  {
    corp_code: '00999999',
    corp_name: '공시리위험샘플',
    stock_code: '099999',
    market: 'KOSDAQ',
    risk_level: 'high',
    risk_score: 5,
    last_analyzed: '데모 시드',
  },
]
export const DEMO_COMPANY_CATALOG: WatchlistItem[] = [
  ...SEEDED_COMPANIES,
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

export function createInitialDemoSessionState(): DemoSessionState {
  return {
    auth: {
      isAuthenticated: true,
      role: 'admin',
      displayName: '공시리 데모 관리자',
      onboardingComplete: true,
    },
    companyCatalog: DEMO_COMPANY_CATALOG,
    watchlistByCorpCode: {},
    watchlistOrder: [],
    addStatus: { state: 'idle', message: '' },
    lastManualCheck: null,
    reportSummariesByCorpCode: {},
    reportDetailsByCorpCode: {},
    recentDisclosures: [],
    loadStatus: { state: 'loading', message: '' },
  }
}
