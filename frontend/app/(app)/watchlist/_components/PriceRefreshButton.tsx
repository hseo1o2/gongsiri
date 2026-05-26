"use client";

import { useState } from "react";

interface PriceRefreshButtonProps {
  items: Array<{ stock_code: string; market: string; corp_code: string }>;
  onUpdate: (
    prices: Map<string, { price: number | null; change_rate: number | null }>
  ) => void;
}

export default function PriceRefreshButton({
  items,
  onUpdate,
}: PriceRefreshButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        items.map((i) =>
          fetch(`/api/quote/${i.stock_code}?market=${i.market}`).then((r) =>
            r.json()
          )
        )
      );

      const priceMap = new Map<
        string,
        { price: number | null; change_rate: number | null }
      >();

      let allFailed = true;
      results.forEach((result, idx) => {
        const stock_code = items[idx].stock_code;
        if (result.status === "fulfilled") {
          allFailed = false;
          priceMap.set(stock_code, {
            price: result.value.price ?? null,
            change_rate: result.value.change_rate ?? null,
          });
        } else {
          priceMap.set(stock_code, { price: null, change_rate: null });
        }
      });

      if (allFailed && items.length > 0) {
        alert("주가 갱신에 실패했습니다");
      }

      onUpdate(priceMap);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: "var(--radius-md)",
        border: "0.5px solid var(--color-border-tertiary)",
        background: "var(--color-bg-secondary)",
        color: "var(--color-text-secondary)",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "갱신 중..." : "↻ 주가 갱신"}
    </button>
  );
}
