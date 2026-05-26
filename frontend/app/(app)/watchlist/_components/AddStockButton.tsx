"use client";

import { useState } from "react";
import AddStockModal from "./AddStockModal";

interface Props {
  onAdded?: () => void;
}

export default function AddStockButton({ onAdded }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          height: 36,
          padding: "0 16px",
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          background: "var(--color-accent)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
        }}
      >
        + 종목 추가
      </button>
      {showModal && (
        <AddStockModal onClose={() => setShowModal(false)} onAdded={onAdded} />
      )}
    </>
  );
}
