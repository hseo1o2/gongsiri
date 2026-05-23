"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  addWatchlistItem as persistWatchlistItem,
  deleteWatchlistItem as persistWatchlistDelete,
  fetchDashboardSnapshot,
  fetchRecentDisclosures,
} from "@/lib/api/dev-data";
import type { WatchlistItem } from "@/lib/types";
import type { DemoSessionAction, DemoSessionState } from "./types";
import {
  demoSessionReducer,
  searchDemoCompanies,
  selectDashboardSummary,
  selectQaStockOptions,
  selectReportSummaries,
  selectWatchlist,
} from "./reducer";
import { createInitialDemoSessionState } from "./seed";

interface DemoSessionContextValue {
  state: DemoSessionState;
  dispatch: React.Dispatch<DemoSessionAction>;
  reloadSession: () => Promise<void>;
  addWatchlistItem: (item: WatchlistItem) => Promise<WatchlistItem>;
  removeWatchlistItem: (corpCode: string) => Promise<void>;
  watchlist: ReturnType<typeof selectWatchlist>;
  reportSummaries: ReturnType<typeof selectReportSummaries>;
  dashboardSummary: ReturnType<typeof selectDashboardSummary>;
  qaStockOptions: ReturnType<typeof selectQaStockOptions>;
  searchCompanies: (query: string) => ReturnType<typeof searchDemoCompanies>;
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    demoSessionReducer,
    undefined,
    createInitialDemoSessionState,
  );
  // StrictMode 두 번 마운트·재요청 시 늦게 도착한 응답이 최신 결과를 덮어쓰는 것을 막는다.
  const latestRequestId = useRef(0);
  const isMounted = useRef(true);

  const reloadSession = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    dispatch({ type: "session/loadStart" });

    try {
      const [dashboard, recentDisclosures] = await Promise.all([
        fetchDashboardSnapshot(),
        fetchRecentDisclosures(),
      ]);
      if (!isMounted.current || requestId !== latestRequestId.current) return;
      dispatch({
        type: "session/loadSuccess",
        watchlist: dashboard.watchlist,
        recentDisclosures,
      });
    } catch (error) {
      if (!isMounted.current || requestId !== latestRequestId.current) return;
      const message =
        error instanceof Error
          ? error.message
          : "저 공시리가 대시보드 데이터를 불러오지 못했습니다.";
      dispatch({ type: "session/loadError", message });
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    void reloadSession();
    return () => {
      isMounted.current = false;
    };
  }, [reloadSession]);

  const addWatchlistItem = useCallback(async (item: WatchlistItem) => {
    const saved = await persistWatchlistItem(item);
    dispatch({ type: "watchlist/add", item: saved });
    return saved;
  }, []);

  const removeWatchlistItem = useCallback(async (corpCode: string) => {
    await persistWatchlistDelete(corpCode);
    dispatch({ type: "watchlist/remove", corpCode });
  }, []);

  const searchCompanies = useCallback(
    (query: string) => searchDemoCompanies(state, query),
    [state],
  );
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
    [
      addWatchlistItem,
      reloadSession,
      removeWatchlistItem,
      searchCompanies,
      state,
    ],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSession() {
  const value = useContext(DemoSessionContext);
  if (!value) {
    throw new Error("useDemoSession must be used inside DemoSessionProvider");
  }
  return value;
}
