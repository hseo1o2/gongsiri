"use client";

import { useCallback, useEffect, useState } from "react";
import { IconTrash, IconRefresh } from "@tabler/icons-react";
import Topbar from "@/components/layout/Topbar";
import RiskBadge from "@/components/ui/RiskBadge";
import AddStockModal from "./_components/AddStockModal";
import CheckButton from "./_components/CheckButton";
import PriceCell from "./_components/PriceCell";
import type { RiskLevel } from "@/lib/types";

interface WatchlistItemData {
  corp_code: string;
  corp_name: string;
  name: string;
  stock_code: string;
  market: string;
  added_at: string;
  last_checked?: string | null;
  risk_level?: RiskLevel;
  risk_score?: number;
  price?: number | null;
  change_rate?: number | null;
}

type PriceMap = Map<
  string,
  { price: number | null; change_rate: number | null }
>;

async function loadWatchlist(): Promise<WatchlistItemData[]> {
  try {
    const res = await fetch(`/api/watchlist`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

async function fetchPrices(
  items: Array<{ stock_code: string; market: string; corp_code: string }>,
): Promise<PriceMap> {
  const results = await Promise.allSettled(
    items.map((i) =>
      fetch(`/api/quote/${i.stock_code}?market=${i.market}`).then((r) =>
        r.json(),
      ),
    ),
  );

  const priceMap: PriceMap = new Map();
  results.forEach((result, idx) => {
    const stock_code = items[idx].stock_code;
    if (result.status === "fulfilled") {
      priceMap.set(stock_code, {
        price: result.value.price ?? null,
        change_rate: result.value.change_rate ?? null,
      });
    } else {
      priceMap.set(stock_code, { price: null, change_rate: null });
    }
  });
  return priceMap;
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItemData[]>([]);
  const [prices, setPrices] = useState<PriceMap>(new Map());
  const [filterQuery, setFilterQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    loadWatchlist().then(setWatchlist);
  }, []);

  const refreshPrices = useCallback(async (items: WatchlistItemData[]) => {
    if (items.length === 0) return;
    setRefreshing(true);
    try {
      const map = await fetchPrices(
        items.map((i) => ({
          stock_code: i.stock_code,
          market: i.market,
          corp_code: i.corp_code,
        })),
      );
      setPrices(map);
      setLastUpdatedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (watchlist.length === 0) return;
    const initial = setTimeout(() => refreshPrices(watchlist), 0);
    const id = setInterval(() => refreshPrices(watchlist), 30_000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [watchlist, refreshPrices]);

  const filteredWatchlist = filterQuery.trim()
    ? watchlist.filter(
        (item) =>
          item.name.includes(filterQuery) ||
          item.corp_name?.includes(filterQuery) ||
          item.stock_code.includes(filterQuery),
      )
    : watchlist;

  const lastUpdatedLabel = lastUpdatedAt
    ? `마지막 갱신 ${lastUpdatedAt.getHours().toString().padStart(2, "0")}:${lastUpdatedAt.getMinutes().toString().padStart(2, "0")}`
    : null;

  return (
    <div>
      <Topbar
        title="워치리스트"
        onSearchChange={setFilterQuery}
        ctaLabel="종목 추가"
        onCta={() => setShowAdd(true)}
      />
      <div style={{ padding: 16 }}>
        <div
          style={{
            background: "var(--color-bg-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          {/* Table header */}
          <div
            style={{
              padding: "7px 16px",
              background: "var(--color-bg-secondary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {/* Column labels — mimic the grid proportions */}
            <div
              style={{
                flex: 1,
                display: "grid",
                gridTemplateColumns: "1fr 90px 72px 80px 80px 40px",
                gap: 8,
                alignItems: "center",
              }}
            >
              {["종목", "현재가", "등락", "리스크", "체크", ""].map((h, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 10.5,
                    color: "var(--color-text-tertiary)",
                    fontWeight: 500,
                    textAlign: i >= 1 && i <= 2 ? "right" : "left",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
            {/* Last updated meta + ghost refresh icon — right-aligned in header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              {(lastUpdatedLabel || refreshing) && (
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--color-text-tertiary)",
                    letterSpacing: "-0.02em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {refreshing ? "갱신 중..." : lastUpdatedLabel}
                </span>
              )}
              <button
                onClick={() => refreshPrices(watchlist)}
                disabled={refreshing}
                style={{
                  background: "none",
                  border: "none",
                  cursor: refreshing ? "default" : "pointer",
                  color: "var(--color-text-tertiary)",
                  display: "flex",
                  alignItems: "center",
                  padding: 0,
                  opacity: refreshing ? 0.4 : 0.6,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!refreshing)
                    (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  if (!refreshing)
                    (e.currentTarget as HTMLButtonElement).style.opacity =
                      "0.6";
                }}
              >
                <IconRefresh size={12} />
              </button>
            </div>
          </div>

          {/* Rows */}
          {filteredWatchlist.length === 0 ? (
            <div
              style={{
                padding: "28px 16px",
                textAlign: "center",
                color: "var(--color-text-tertiary)",
                fontSize: 13,
                letterSpacing: "-0.02em",
              }}
            >
              {watchlist.length === 0
                ? "등록된 워치리스트 종목이 없습니다."
                : "검색 결과가 없습니다."}
            </div>
          ) : (
            filteredWatchlist.map((item) => (
              <div
                key={item.corp_code}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 90px 72px 80px 80px 40px",
                  padding: "12px 16px",
                  borderBottom: "0.5px solid var(--color-border-tertiary)",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</p>
                  <p
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    {item.stock_code} · {item.market}
                  </p>
                </div>
                <PriceCell
                  price={
                    prices.get(item.stock_code)?.price ?? item.price ?? null
                  }
                  changeRate={null}
                />
                <PriceCell
                  price={null}
                  changeRate={
                    prices.get(item.stock_code)?.change_rate ??
                    item.change_rate ??
                    null
                  }
                />
                <RiskBadge level={item.risk_level ?? "normal"} size="sm" />
                <CheckButton corpCode={item.corp_code} />
                <DeleteButton corpCode={item.corp_code} onDeleted={refresh} />
              </div>
            ))
          )}
        </div>
      </div>

      {showAdd && (
        <AddStockModal onClose={() => setShowAdd(false)} onAdded={refresh} />
      )}
    </div>
  );
}

function DeleteButton({
  corpCode,
  onDeleted,
}: {
  corpCode: string;
  onDeleted?: () => void;
}) {
  async function handleDelete() {
    const res = await fetch(
      `/api/watchlist?corp_code=${encodeURIComponent(corpCode)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      onDeleted?.();
    }
  }

  return (
    <button
      onClick={handleDelete}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--color-text-tertiary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <IconTrash size={14} />
    </button>
  );
}
