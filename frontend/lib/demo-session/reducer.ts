import type { ReportDetailContract, ReportSummaryContract } from '@/lib/api/types'
import type { CompanyInfo, WatchlistItem } from '@/lib/types'
import type { DemoDashboardSummary, DemoQaStockOption, DemoSessionAction, DemoSessionState } from './types'
import { createInitialDemoSessionState } from './seed'

export function demoSessionReducer(
  state: DemoSessionState,
  action: DemoSessionAction,
): DemoSessionState {
  switch (action.type) {
    case 'session/loadStart':
      return { ...state, loadStatus: { state: 'loading', message: '' } }
    case 'session/loadSuccess':
      return {
        ...state,
        watchlistByCorpCode: byCorpCode(action.watchlist),
        watchlistOrder: action.watchlist.map(item => item.corp_code),
        reportSummariesByCorpCode: byCorpCode(action.watchlist.map(toReportSummary)),
        recentDisclosures: action.recentDisclosures,
        loadStatus: { state: 'ready', message: '' },
      }
    case 'session/loadError':
      return { ...state, loadStatus: { state: 'error', message: action.message } }
    case 'watchlist/add': {
      const corpCode = action.item.corp_code
      if (state.watchlistByCorpCode[corpCode]) {
        return {
          ...state,
          addStatus: {
            state: 'duplicate',
            corpCode,
            message: `${action.item.corp_name}은 이미 워치리스트에 있습니다.`,
          },
        }
      }
      return {
        ...state,
        watchlistByCorpCode: { ...state.watchlistByCorpCode, [corpCode]: action.item },
        watchlistOrder: [...state.watchlistOrder, corpCode],
        reportSummariesByCorpCode: {
          ...state.reportSummariesByCorpCode,
          [corpCode]: {
            corpCode,
            corpName: action.item.corp_name,
            analyzedAt: action.item.last_analyzed ?? '데모 세션',
            riskLevel: action.item.risk_level ?? 'normal',
            riskScore: action.item.risk_score ?? 0,
          },
        },
        addStatus: {
          state: 'added',
          corpCode,
          message: `${action.item.corp_name}을 워치리스트에 추가했습니다.`,
        },
      }
    }
    case 'watchlist/remove': {
      const remainingWatchlist = { ...state.watchlistByCorpCode }
      delete remainingWatchlist[action.corpCode]
      return {
        ...state,
        watchlistByCorpCode: remainingWatchlist,
        watchlistOrder: state.watchlistOrder.filter(code => code !== action.corpCode),
      }
    }
    case 'watchlist/notFound':
      return {
        ...state,
        addStatus: { state: 'not-found', message: `${action.query} 검색 결과가 없습니다.` },
      }
    case 'manualCheck/record':
      return { ...state, lastManualCheck: action.snapshot }
    case 'reports/upsertSummary':
      return {
        ...state,
        reportSummariesByCorpCode: {
          ...state.reportSummariesByCorpCode,
          [action.summary.corpCode]: action.summary,
        },
      }
    case 'reports/upsertDetail':
      return upsertReportDetail(state, action.detail)
    case 'session/reset':
      return createInitialDemoSessionState()
    default:
      return state
  }
}

function upsertReportDetail(
  state: DemoSessionState,
  detail: ReportDetailContract,
): DemoSessionState {
  return {
    ...state,
    reportDetailsByCorpCode: { ...state.reportDetailsByCorpCode, [detail.corpCode]: detail },
    reportSummariesByCorpCode: {
      ...state.reportSummariesByCorpCode,
      [detail.corpCode]: {
        corpCode: detail.corpCode,
        corpName: detail.corpName,
        analyzedAt: detail.analyzedAt,
        riskLevel: detail.riskLevel,
        riskScore: detail.riskScore,
      },
    },
  }
}

function byCorpCode<T extends { corpCode?: string; corp_code?: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(
    items.flatMap(item => {
      const corpCode = item.corpCode ?? item.corp_code
      return corpCode ? [[corpCode, item]] : []
    }),
  )
}

function toReportSummary(item: WatchlistItem): ReportSummaryContract {
  return {
    corpCode: item.corp_code,
    corpName: item.corp_name,
    analyzedAt: item.last_analyzed ?? '데모 DB',
    riskLevel: item.risk_level ?? 'normal',
    riskScore: item.risk_score ?? 0,
  }
}

export function selectWatchlist(state: DemoSessionState) {
  return state.watchlistOrder.flatMap(code => state.watchlistByCorpCode[code] ?? [])
}

export function selectReportSummaries(state: DemoSessionState) {
  return Object.values(state.reportSummariesByCorpCode).sort((left, right) =>
    left.corpName.localeCompare(right.corpName, 'ko'),
  )
}

export function selectDashboardSummary(state: DemoSessionState): DemoDashboardSummary {
  const watchlist = selectWatchlist(state)
  return {
    count: watchlist.length,
    todayDisclosures: state.lastManualCheck?.acceptedCorpCodes.length ?? state.recentDisclosures.filter(item => item.time === state.recentDisclosures[0]?.time).length,
    cautionCount: watchlist.filter(item => item.risk_level === 'caution').length,
    dangerCount: watchlist.filter(item => item.risk_level === 'high').length,
  }
}

export function selectQaStockOptions(state: DemoSessionState): DemoQaStockOption[] {
  const watchlistOptions = selectWatchlist(state).map(item => ({
    corp_code: item.corp_code,
    corp_name: item.corp_name,
    risk_level: item.risk_level ?? 'normal',
  }))
  if (watchlistOptions.length > 0) return watchlistOptions

  return selectReportSummaries(state).map(summary => ({
    corp_code: summary.corpCode,
    corp_name: summary.corpName,
    risk_level: summary.riskLevel,
  }))
}

export function searchDemoCompanies(state: DemoSessionState, query: string): CompanyInfo[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('ko')
  if (!normalizedQuery) return []

  return state.companyCatalog
    .filter(item => {
      const haystack = [item.corp_name, item.stock_code, item.corp_code, item.market]
        .join(' ')
        .toLocaleLowerCase('ko')
      return haystack.includes(normalizedQuery)
    })
    .slice(0, 8)
    .map(item => ({
      corp_code: item.corp_code,
      corp_name: item.corp_name,
      stock_code: item.stock_code,
      market: item.market,
    }))
}
