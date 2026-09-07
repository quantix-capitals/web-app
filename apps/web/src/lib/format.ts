export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Money and percentages are the only numbers on this product, and both must line
 * up in a column — every readout that renders one wears `tabular-nums`.
 */
export function formatMoney(
  amount: number,
  currency: string = "INR",
  locale: string = "en-IN",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Signed, because a return without its sign is a number nobody can read. */
export function formatPercent(fraction: number, digits = 2): string {
  const sign = fraction > 0 ? "+" : "";
  return `${sign}${(fraction * 100).toFixed(digits)}%`;
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** The direction a figure moved, as a tone the primitives already understand. */
export function moveTone(change: number): "gain" | "loss" | "neutral" {
  if (change > 0) return "gain";
  if (change < 0) return "loss";
  return "neutral";
}
