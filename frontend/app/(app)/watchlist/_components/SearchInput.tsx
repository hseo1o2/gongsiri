"use client";

import { IconSearch, IconX } from "@tabler/icons-react";
import type { CompanyInfo } from "@/lib/types";
import { useEffect, useState } from "react";

interface Props {
  onSelect: (company: CompanyInfo) => void;
}

export default function SearchInput({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyInfo[]>([]);
  const hasQuery = Boolean(query.trim());

  useEffect(() => {
    if (!query.trim()) {
      return;
    }

    const timer = setTimeout(() => {
      fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          const items: CompanyInfo[] = Array.isArray(data.items)
            ? data.items
            : [];
          setResults(items.slice(0, 10));
        })
        .catch(() => setResults([]));
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(company: CompanyInfo) {
    onSelect(company);
    setQuery("");
    setResults([]);
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        <IconSearch
          size={16}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-text-tertiary)",
            pointerEvents: "none",
          }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="종목명 또는 코드 검색"
          style={{
            width: "100%",
            height: 40,
            padding: "0 36px",
            fontSize: 14,
            fontFamily: "Noto Sans KR, sans-serif",
            letterSpacing: "-0.03em",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-bg-primary)",
            outline: "none",
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-tertiary)",
            }}
          >
            <IconX size={14} />
          </button>
        )}
      </div>

      {hasQuery && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--color-bg-primary)",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--radius-md)",
            marginTop: 4,
            zIndex: 50,
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          {results.length === 0 && (
            <p
              style={{
                padding: "10px 14px",
                fontSize: 13,
                color: "var(--color-text-tertiary)",
              }}
            >
              검색 결과가 없습니다.
            </p>
          )}
          {results.map((c) => (
            <button
              key={c.corp_code ?? c.stock_code}
              onClick={() => handleSelect(c)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                border: "none",
                background: "none",
                cursor: "pointer",
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {c.corp_name}
                </p>
                <p
                  className="font-mono"
                  style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}
                >
                  {c.stock_code}
                </p>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--color-text-tertiary)",
                  background: "var(--color-bg-secondary)",
                  padding: "2px 8px",
                  borderRadius: 100,
                }}
              >
                {c.market}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
