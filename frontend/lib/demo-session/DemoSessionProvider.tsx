'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import {
  addWatchlistItem as persistWatchlistItem,
  deleteWatchlistItem as persistWatchlistDelete,
  fetchDashboardSnapshot,
  fetchRecentDisclosures,
} from '@/lib/api/dev-data'
import type { WatchlistItem } from '@/lib/types'
import type { DemoSessionAction, DemoSessionState } from './types'
import {
  demoSessionReducer,
  searchDemoCompanies,
  selectDashboardSummary,
  selectQaStockOptions,
  selectReportSummaries,
  selectWatchlist,
} from './reducer'
import { createInitialDemoSessionState } from './seed'

interface DemoSessionContextValue {
  state: DemoSessionState
  dispatch: React.Dispatch<DemoSessionAction>
  reloadSession: () => Promise<void>
  addWatchlistItem: (item: WatchlistItem) => Promise<WatchlistItem>
  removeWatchlistItem: (corpCode: string) => Promise<void>
  watchlist: ReturnType<typeof selectWatchlist>
  reportSummaries: ReturnType<typeof selectReportSummaries>
  dashboardSummary: ReturnType<typeof selectDashboardSummary>
  qaStockOptions: ReturnType<typeof selectQaStockOptions>
  searchCompanies: (query: string) => ReturnType<typeof searchDemoCompanies>
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null)

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoSessionReducer, undefined, createInitialDemoSessionState)

  const reloadSession = useCallback(async () => {
    dispatch({ type: 'session/loadStart' })

    try {
      const [dashboard, recentDisclosures] = await Promise.all([
        fetchDashboardSnapshot(),
        fetchRecentDisclosures(),
      ])
      dispatch({
        type: 'session/loadSuccess',
        watchlist: dashboard.watchlist,
        recentDisclosures,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '저 공시리가 대시보드 데이터를 불러오지 못했습니다.'
      dispatch({ type: 'session/loadError', message })
    }
  }, [])

  useEffect(() => {
    void reloadSession()
  }, [reloadSession])

  const addWatchlistItem = useCallback(async (item: WatchlistItem) => {
    const saved = await persistWatchlistItem(item)
    dispatch({ type: 'watchlist/add', item: saved })
    return saved
  }, [])

  const removeWatchlistItem = useCallback(async (corpCode: string) => {
    await persistWatchlistDelete(corpCode)
    dispatch({ type: 'watchlist/remove', corpCode })
  }, [])

  const searchCompanies = useCallback((query: string) => searchDemoCompanies(state, query), [state])
  const value = useMemo(
    () => ({
      state,
      dispatch,
      reloadSession,
      addWatchlistItem,
      removeWatchlistItem,
      watchlist: selectWatchlist(state),
      reportSummaries: selectReportSummaries(state),
      dashboardSummary: selectDashboardSummary(state),
      qaStockOptions: selectQaStockOptions(state),
      searchCompanies,
    }),
    [addWatchlistItem, reloadSession, removeWatchlistItem, searchCompanies, state],
  )

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>
}

export function useDemoSession() {
  const value = useContext(DemoSessionContext)
  if (!value) {
    throw new Error('useDemoSession must be used inside DemoSessionProvider')
  }
  return value
}
