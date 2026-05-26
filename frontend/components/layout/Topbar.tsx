"use client";
import { IconSearch, IconPlus } from "@tabler/icons-react";
import Button from "@/components/ui/Button";

interface Props {
  title: string;
  showSearch?: boolean;
  onSearchChange?: (value: string) => void;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function Topbar({
  title,
  showSearch = true,
  onSearchChange,
  ctaLabel,
  onCta,
}: Props) {
  return (
    <div
      style={{
        background: "var(--color-bg-primary)",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        padding: "0 20px",
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          flex: 1,
        }}
      >
        {title}
      </span>
      {showSearch && (
        <div style={{ position: "relative" }}>
          <IconSearch
            size={14}
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-tertiary)",
            }}
          />
          <input
            type="text"
            placeholder="종목 검색"
            onChange={(e) => onSearchChange?.(e.target.value)}
            style={{
              height: 32,
              width: 180,
              padding: "0 10px 0 28px",
              fontSize: 12,
              fontFamily: "Noto Sans KR, sans-serif",
              letterSpacing: "-0.03em",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg-secondary)",
              outline: "none",
            }}
          />
        </div>
      )}
      {ctaLabel && (
        <Button size="sm" onClick={onCta}>
          <IconPlus size={13} />
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
