"use client";

import { useState } from "react";
import { IconX } from "@tabler/icons-react";
import Button from "@/components/ui/Button";
import type { CompanyInfo } from "@/lib/types";
import SearchInput from "./SearchInput";

interface Props {
  onClose: () => void;
  onAdded?: () => void;
}

export default function AddStockModal({ onClose, onAdded }: Props) {
  const [selected, setSelected] = useState<CompanyInfo | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!selected) return;
    setDone(false);
    setError("");

    if (!selected.corp_code || !selected.market) {
      setError(`${selected.corp_name} 종목 정보를 찾을 수 없습니다.`);
      return;
    }

    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          corp_code: selected.corp_code,
          stock_code: selected.stock_code,
          name: selected.corp_name,
          market: selected.market,
          added_at: new Date().toISOString(),
        }),
      });

      if (res.status === 201) {
        setDone(true);
        setTimeout(() => {
          onClose();
          onAdded?.();
        }, 900);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          data?.detail ?? "저 공시리가 워치리스트를 저장하지 못했습니다.",
        );
      }
    } catch {
      setError("저 공시리가 워치리스트를 저장하지 못했습니다.");
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
          검색한 종목을 선택하면 워치리스트에 추가됩니다.
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
            ✓ 워치리스트에 등록되었습니다
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
