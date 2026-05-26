import { IconTrash } from "@tabler/icons-react";
import Topbar from "@/components/layout/Topbar";
import RiskBadge from "@/components/ui/RiskBadge";
import RiskProgressBar from "@/components/ui/RiskProgressBar";
import AddStockButton from "./_components/AddStockButton";

interface WatchlistItemData {
  corp_code: string;
  name: string;
  stock_code: string;
  market: string;
  added_at: string;
  last_checked?: string | null;
}

interface CheckButtonSlotProps {
  corpCode: string;
}

interface PriceCellSlotProps {
  stockCode: string;
  market: string;
}

interface PriceRefreshSlotProps {
  items: Array<{ stock_code: string; market: string; corp_code: string }>;
}

function CheckButtonSlot(_: CheckButtonSlotProps) {
  return null;
}

function PriceCellSlot(_: PriceCellSlotProps) {
  return null;
}

function PriceRefreshSlot(_: PriceRefreshSlotProps) {
  return null;
}

async function fetchWatchlist(): Promise<WatchlistItemData[]> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${apiBase}/api/watchlist`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

export default async function WatchlistPage() {
  const watchlist = await fetchWatchlist();

  return (
    <div>
      <Topbar title="워치리스트" />
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <AddStockButton />
          <PriceRefreshSlot
            items={watchlist.map((i) => ({
              stock_code: i.stock_code,
              market: i.market,
              corp_code: i.corp_code,
            }))}
          />
        </div>
        <div
          style={{
            background: "var(--color-bg-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 90px 72px 80px 120px 80px 40px",
              padding: "7px 16px",
              background: "var(--color-bg-secondary)",
              gap: 8,
            }}
          >
            {[
              "종목",
              "현재가",
              "등락",
              "리스크",
              "작전주 지수",
              "체크",
              "",
            ].map((h, i) => (
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
          {watchlist.length === 0 ? (
            <div
              style={{
                padding: "28px 16px",
                textAlign: "center",
                color: "var(--color-text-tertiary)",
                fontSize: 13,
                letterSpacing: "-0.02em",
              }}
            >
              등록된 워치리스트 종목이 없습니다.
            </div>
          ) : (
            watchlist.map((item) => (
              <div
                key={item.corp_code}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 90px 72px 80px 120px 80px 40px",
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
                <PriceCellSlot
                  stockCode={item.stock_code}
                  market={item.market}
                />
                <PriceCellSlot
                  stockCode={item.stock_code}
                  market={item.market}
                />
                <RiskBadge level="normal" size="sm" />
                <RiskProgressBar score={0} level="normal" />
                <CheckButtonSlot corpCode={item.corp_code} />
                <DeleteButton corpCode={item.corp_code} />
              </div>
            ))
          )}
        </div>
        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "var(--color-text-tertiary)",
            letterSpacing: "-0.02em",
          }}
        >
          등록하거나 삭제한 종목은 워치리스트에 바로 반영됩니다.
        </p>
      </div>
    </div>
  );
}

function DeleteButton({ corpCode }: { corpCode: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const apiBase =
          process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
        await fetch(
          `${apiBase}/api/watchlist?corp_code=${encodeURIComponent(corpCode)}`,
          {
            method: "DELETE",
            cache: "no-store",
          },
        );
      }}
    >
      <button
        type="submit"
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
    </form>
  );
}
