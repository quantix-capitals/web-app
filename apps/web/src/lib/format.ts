export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Money and percentages are the only numbers on this product, and both must line
 * up in a column — every readout that renders one wears `tabular-nums`.
 */
export function formatMoney(
  amount: number,
  /** A delta (P&L, day change) always carries its sign; a level (price,
   * value) never does — pass true only for the former. */
  signed: boolean = false,
  currency: string = "INR",
  locale: string = "en-IN",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    signDisplay: signed ? "exceptZero" : "auto",
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

/**
 * Money short enough for an axis tick: ₹1.2L, ₹3.4Cr. Indian grouping, because
 * a reader who thinks in lakhs should not have to convert from millions to
 * check an axis against the figure above it.
 */
export function formatMoneyCompact(amount: number, signed = false): string {
  const sign = signed && amount > 0 ? "+" : amount < 0 ? "−" : "";
  const short = new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: Math.abs(amount) < 1000 ? 0 : 2,
  }).format(Math.abs(amount));
  return `${sign}₹${short}`;
}

/**
 * A dimensionless ratio — Sharpe, beta, an effective holding count. Never
 * percent-formatted: 1.42 is a Sharpe ratio and "142%" is not a thing.
 */
export function formatRatio(value: number, digits = 2): string {
  return value.toFixed(digits);
}

/** A percentage that is a *level*, not a delta — volatility, a weight, a share. */
export function formatLevelPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
