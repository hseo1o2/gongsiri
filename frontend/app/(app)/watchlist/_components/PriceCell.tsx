interface PriceCellProps {
  price: number | null;
  changeRate: number | null;
}

export default function PriceCell({ price, changeRate }: PriceCellProps) {
  const priceDisplay =
    price != null ? price.toLocaleString() : "—";

  let changeDisplay = "—";
  let changeColor = "var(--color-text-tertiary)";

  if (changeRate != null) {
    if (changeRate > 0) {
      changeDisplay = `▲ ${changeRate.toFixed(2)}%`;
      changeColor = "var(--color-danger, #e53e3e)";
    } else if (changeRate < 0) {
      changeDisplay = `▼ ${Math.abs(changeRate).toFixed(2)}%`;
      changeColor = "var(--color-info, #3182ce)";
    } else {
      changeDisplay = "0.00%";
      changeColor = "var(--color-text-tertiary)";
    }
  }

  return (
    <div style={{ textAlign: "right" }}>
      <p style={{ fontSize: 13, fontWeight: 500 }}>{priceDisplay}</p>
      <p style={{ fontSize: 11, color: changeColor }}>{changeDisplay}</p>
    </div>
  );
}
