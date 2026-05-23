"use client";

import { useState } from "react";
import { IconX } from "@tabler/icons-react";
import Button from "@/components/ui/Button";
import { useDemoSession } from "@/lib/demo-session";
import type { CompanyInfo, WatchlistItem } from "@/lib/types";
import SearchInput from "./SearchInput";

interface Props {
  onClose: () => void;
}

function toWatchlistItem(company: CompanyInfo): WatchlistItem | null {
  if (!company.corp_code || !company.market) return null;
  return {
    corp_code: company.corp_code,
    corp_name: company.corp_name,
    stock_code: company.stock_code,
    market: company.market,
    risk_level: "normal",
    risk_score: 0,
    last_analyzed: "데모 세션",
  };
}

export default function AddStockModal({ onClose }: Props) {
  const { addWatchlistItem, dispatch, state } = useDemoSession();
  const [selected, setSelected] = useState<CompanyInfo | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!selected) return;
    setDone(false);
    setError("");

    const item = toWatchlistItem(selected);
    if (!item) {
      dispatch({ type: "watchlist/notFound", query: selected.corp_name });
      setError(
        `${selected.corp_name}은 데모 종목 카탈로그에서 찾을 수 없습니다.`,
      );
      return;
    }

    if (state.watchlistByCorpCode[item.corp_code]) {
      // 이미 워치리스트에 있으면 모달 내 에러로만 안내하고 reducer dispatch는 생략한다.
      setError(`${item.corp_name}은 이미 워치리스트에 있습니다.`);
      return;
    }

    try {
      await addWatchlistItem(item);
      setDone(true);
      setTimeout(onClose, 900);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "저 공시리가 워치리스트를 저장하지 못했습니다.",
      );
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-bg-primary)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          width: 400,
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2
            style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.04em" }}
          >
            종목 추가
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-tertiary)",
            }}
          >
            <IconX size={18} />
          </button>
        </div>

        <SearchInput
          onSelect={(company) => {
            setSelected(company);
            setDone(false);
            setError("");
          }}
        />
        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "var(--color-text-tertiary)",
            letterSpacing: "-0.02em",
          }}
        >
          검색 결과는 dev seed 카탈로그 기준이며, 선택 후 저장은 backend BFF를
          거쳐 dev DB에 반영됩니다.
        </p>

        {selected && (
          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              background: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--color-border-tertiary)",
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "-0.03em",
              }}
            >
              {selected.corp_name}
            </p>
            <p
              className="font-mono"
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                marginTop: 2,
              }}
            >
              {selected.stock_code} · {selected.market}
            </p>
          </div>
        )}

        {done && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "#639922",
              letterSpacing: "-0.02em",
            }}
          >
            ✓ 등록 완료 — 데모 세션 워치리스트에 반영됨
          </p>
        )}

        {error && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: "#A32D2D",
              letterSpacing: "-0.02em",
            }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            justifyContent: "flex-end",
          }}
        >
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={() => void handleAdd()} disabled={!selected}>
            종목 추가
          </Button>
        </div>
      </div>
    </div>
  );
}
