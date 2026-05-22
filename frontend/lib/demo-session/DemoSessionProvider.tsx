'use client'

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react'
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
  watchlist: ReturnType<typeof selectWatchlist>
  reportSummaries: ReturnType<typeof selectReportSummaries>
  dashboardSummary: ReturnType<typeof selectDashboardSummary>
  qaStockOptions: ReturnType<typeof selectQaStockOptions>
  searchCompanies: (query: string) => ReturnType<typeof searchDemoCompanies>
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null)

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoSessionReducer, undefined, createInitialDemoSessionState)
  const searchCompanies = useCallback((query: string) => searchDemoCompanies(state, query), [state])
  const value = useMemo(
    () => ({
      state,
      dispatch,
      watchlist: selectWatchlist(state),
      reportSummaries: selectReportSummaries(state),
      dashboardSummary: selectDashboardSummary(state),
      qaStockOptions: selectQaStockOptions(state),
      searchCompanies,
    }),
    [searchCompanies, state],
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
