/**
 * The measurements the agent reasons over. Facts only — no verdicts.
 *
 * The division of labour in this module matters more than anything in it. The
 * arithmetic — returns, averages, drawdowns, weights, the composite screen — is
 * done here, deterministically, in the browser, from the same bars and the same
 * live quotes the table beside the sidebar is showing. The *judgement* is the
 * model's, in `agent.ts`, and it reaches these numbers only through tools.
 *
 * Which means a language model is never asked to do sums it will do badly, and
 * never gets to invent a price. If the agent says a holding is 14% below its
 * 200-day average, that figure came from `signals.ts`; if it says that is a
 * reason to sell, that part is the model's and can be argued with.
 *
 * The screen score below is a **prior, not a verdict**. It is a transparent
 * weighted composite, handed to the model as one input among several, and the
 * prompt is explicit that disagreeing with it is allowed provided the
 * disagreement is argued. Shipping the screen as the answer would make the model
 * decorative; hiding it would leave the model to eyeball nine series.
 */

import { instrumentKey, toYahooSymbol } from "@stealth/shared";
import type { QuoteMap, SymbolHistory } from "@stealth/shared";
import { formatLevelPercent, formatPercent } from "@/lib/format";
import type { BookKind, WatchlistItemView, WatchlistSummary } from "@/lib/watchlist/types";
import { MIN_BARS, closes, computeSignals, trailing } from "./signals";
import { BENCH, nameOf } from "./universe";
import { UNCLASSIFIED, sectorOf } from "./sectors";
import type { Regime, Signals } from "./types";

export { BENCHMARK_SYMBOL } from "@/lib/analytics/basket";

/**
 * The composite's factor weights, which are also what the agent quotes when
 * asked how the screen works — so the table in the prompt and these numbers are
 * the same numbers.
 *
 * | Factor      | Weight | What it answers                              |
 * | ----------- | -----: | -------------------------------------------- |
 * | Trend       |     26 | Is the slow trend still up? (50 vs 200-day)  |
 * | Momentum    |     24 | Is the three-month move still positive?      |
 * | Relative    |     20 | Beating the index, or just riding it?         |
 * | Damage      |     18 | How far below its own high has it fallen?     |
 * | Volatility  |     12 | Weighted least: volatility is a price, not a defect. |
 */
export const WEIGHTS = {
  trend: 26,
  momentum: 24,
  relative: 20,
  damage: 18,
  volatility: 12,
} as const;

/** Linear with flat ends — see the note in `agent.ts` about explainability. */
function band(value: number, worst: number, best: number): number {
  if (best === worst) return 0.5;
  return Math.max(0, Math.min(1, (value - worst) / (best - worst)));
}

/**
 * The screen, 0–100, over whichever factors could be measured.
 *
 * Missing factors are dropped and the weights renormalised over what is left,
 * rather than scored as a neutral 0.5: a symbol with four months of history would
 * otherwise be marked down against one with four years purely for being new.
 * Thin history lowers `confidence`, which the model is told about, and does not
 * move the score.
 */
export function screen(s: Signals): number {
  const parts: Array<[number, number | null]> = [
    [
      WEIGHTS.trend,
      s.vsSma200 === null && s.trendUp === null
        ? null
        : (s.vsSma200 === null ? 0.5 : band(s.vsSma200, -0.15, 0.2)) * 0.55 +
          (s.trendUp === null ? 0.5 : s.trendUp ? 1 : 0) * 0.45,
    ],
    [
      WEIGHTS.momentum,
      s.ret3m === null
        ? null
        : band(s.ret3m, -0.2, 0.25) * 0.7 +
          (s.ret1m === null ? band(s.ret3m, -0.2, 0.25) : band(s.ret1m, -0.12, 0.12)) * 0.3,
    ],
    [WEIGHTS.relative, s.rs3m === null ? null : band(s.rs3m, -0.12, 0.12)],
    [WEIGHTS.damage, s.fromHigh === null ? null : band(s.fromHigh, -0.35, -0.02)],
    [WEIGHTS.volatility, s.vol === null ? null : 1 - band(s.vol, 0.16, 0.55)],
  ];

  let weighted = 0;
  let available = 0;
  for (const [weight, value] of parts) {
    if (value === null) continue;
    weighted += value * weight;
    available += weight;
  }
  return available === 0 ? 50 : Math.round((weighted / available) * 100);
}

export function confidenceOf(s: Signals): "high" | "medium" | "low" {
  const known = [s.ret3m, s.vsSma200, s.rs3m, s.fromHigh, s.vol].filter((v) => v !== null).length;
  if (s.bars >= 200 && known >= 5) return "high";
  if (s.bars >= 120 && known >= 4) return "medium";
  return "low";
}

// --- positions ---------------------------------------------------------------

/** One symbol in the basket, however many rows it occupies. */
export interface Position {
  key: string;
  symbol: string;
  exchange: string;
  name: string | null;
  sector: string;
  quantity: number;
  /** Quantity-weighted, so a symbol added twice has one honest baseline. */
  entryPrice: number | null;
  /** When the position was first opened — the oldest entry date among its rows. */
  entryAt: string | null;
}

/**
 * Collapses a basket's rows into one row per symbol.
 *
 * A basket can hold the same ticker twice — two entries, bought on different days
 * — and that is one decision, not two. An agent that reviewed it twice would hand
 * back two verdicts to reconcile, and the position it is really advising on is the
 * sum. The baseline is quantity-weighted for the same reason `lib/watchlist/pnl.ts`
 * sums rupees rather than averaging percentages.
 */
export function collapse(items: WatchlistItemView[]): Position[] {
  const byKey = new Map<string, Position>();

  for (const item of items) {
    if (!item.symbol) continue;
    const key = instrumentKey(item);
    const existing = byKey.get(key);
    // A broker holding has no dates at all (`addedAt` is empty), and "held since"
    // is then unknown rather than the epoch.
    const opened = item.entryAt ?? (item.addedAt || null);

    if (!existing) {
      byKey.set(key, {
        key,
        symbol: item.symbol,
        exchange: item.exchange,
        name: item.name ?? nameOf(item.symbol),
        sector: item.sector ?? sectorOf(item.symbol),
        quantity: item.quantity,
        entryPrice: item.entryPrice,
        entryAt: opened,
      });
      continue;
    }

    const cost =
      (existing.entryPrice ?? 0) * existing.quantity + (item.entryPrice ?? 0) * item.quantity;
    const quantity = existing.quantity + item.quantity;
    const based = existing.entryPrice !== null || item.entryPrice !== null;
    existing.quantity = quantity;
    existing.entryPrice = based && quantity > 0 ? cost / quantity : null;
    // The earliest of the two: the position has been held since its first leg.
    if (opened && (!existing.entryAt || opened < existing.entryAt)) existing.entryAt = opened;
  }

  return [...byKey.values()];
}

// --- the measured book -------------------------------------------------------

/** A held symbol with everything measurable about it. What the tools hand over. */
export interface MeasuredHolding extends Position {
  signals: Signals;
  value: number | null;
  weight: number | null;
  screen: number;
  confidence: "high" | "medium" | "low";
  /** The measurements as sentences, so the model quotes figures it did not format. */
  notes: string[];
}

export interface MeasuredCandidate {
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  signals: Signals;
  screen: number;
  notes: string[];
}

/** Which basket is under review — the agent's whole remit. */
export interface BasketMeta {
  id: string;
  /** A basket someone struck, or a broker portfolio. */
  kind: BookKind;
  name: string;
  description: string | null;
  struck: string;
  isOwner: boolean;
}

/** Everything one review works from. Built once per data change, in the hook. */
export interface Book {
  basket: BasketMeta;
  regime: Regime;
  holdings: MeasuredHolding[];
  candidates: MeasuredCandidate[];
  sectors: Array<{ sector: string; weight: number }>;
  /** Held symbols with too little history to judge — disclosed, never scored. */
  skipped: string[];
  /**
   * Held symbols the sector map does not cover.
   *
   * Kept apart from `sectors` on purpose. Folding them into an "Unclassified"
   * bucket made a gap in a lookup table read like a 78% exposure, and the agent
   * duly reported it as the basket's dominant concentration. A missing
   * classification is a fact about this app, not about the portfolio.
   */
  unclassified: string[];
  asOf: string | null;
}

export function measure({
  basket,
  history,
  quotes,
  asOf,
}: {
  basket: WatchlistSummary;
  history: SymbolHistory[];
  quotes: QuoteMap;
  asOf: string | null;
}): Book {
  const bars = new Map(history.map((h) => [h.requested, h.bars]));
  const benchmark = history.find((h) => h.requested === "^NSEI") ?? null;
  const regime = readRegime(benchmark, quotes);

  const holdings: MeasuredHolding[] = [];
  const skipped: string[] = [];

  for (const position of collapse(basket.items)) {
    const yahoo = toYahooSymbol(position);
    const signals = computeSignals({
      bars: bars.get(yahoo) ?? [],
      livePrice: quotes[yahoo]?.price ?? null,
      entryPrice: position.entryPrice,
      benchmarkRet3m: regime.ret3m,
    });

    // Only a holding with no price at all is left out. A short history — a
    // recent listing, or a feed that only has a few weeks — is still judged:
    // every measurement it cannot support comes back null, confidence drops to
    // low, and the notes tell the agent which figures are missing and why.
    // Excluding it outright left a one-stock basket with "nothing to review".
    if (signals.price === null) {
      skipped.push(position.symbol);
      continue;
    }

    holdings.push({
      ...position,
      signals,
      value: signals.price === null ? null : signals.price * position.quantity,
      weight: null,
      screen: screen(signals),
      confidence: confidenceOf(signals),
      notes: describe(signals, regime),
    });
  }

  const total = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
  for (const h of holdings) h.weight = total > 0 && h.value !== null ? h.value / total : null;

  const held = new Set(holdings.map((h) => h.symbol.toUpperCase()));
  const candidates: MeasuredCandidate[] = [];
  for (const candidate of BENCH) {
    // A stock the user already owns is not an alternative to it. Recommending one
    // is advice to concentrate, dressed up as advice to rotate.
    if (held.has(candidate.symbol.toUpperCase())) continue;
    const yahoo = toYahooSymbol(candidate);
    const signals = computeSignals({
      bars: bars.get(yahoo) ?? [],
      // The bench is not polled live — see the note in `use-analyst.ts`.
      livePrice: null,
      entryPrice: null,
      benchmarkRet3m: regime.ret3m,
    });
    if (signals.bars < MIN_BARS) continue;
    candidates.push({
      ...candidate,
      signals,
      screen: screen(signals),
      notes: describe(signals, regime),
    });
  }
  candidates.sort((a, b) => b.screen - a.screen);

  return {
    basket: {
      id: basket.id,
      kind: basket.kind,
      name: basket.name,
      description: basket.description,
      struck: basket.createdAt,
      isOwner: basket.isOwner,
    },
    regime,
    holdings: holdings.sort((a, b) => a.screen - b.screen),
    candidates,
    sectors: rollUpSectors(holdings),
    skipped,
    unclassified: holdings.filter((h) => h.sector === UNCLASSIFIED).map((h) => h.symbol),
    asOf,
  };
}

/**
 * The signals as English.
 *
 * Every figure the agent quotes should have been formatted once, here, by the
 * same helpers the rest of the product formats with — otherwise the sidebar says
 * "14.2% below" and the chat says "0.142 below", and one of them is the model
 * improvising with a float.
 */
function describe(s: Signals, regime: Regime): string[] {
  const notes: string[] = [];

  if (s.vsSma200 !== null) {
    notes.push(
      `${s.vsSma200 >= 0 ? "Above" : "Below"} its 200-day average by ${formatLevelPercent(
        Math.abs(s.vsSma200),
      )}, 50-day average ${s.trendUp === null ? "unmeasurable" : s.trendUp ? "above" : "below"} the 200-day.`,
    );
  }
  if (s.ret3m !== null) {
    notes.push(
      `${formatPercent(s.ret3m)} over three months${
        s.ret1m === null ? "" : `, ${formatPercent(s.ret1m)} over one month`
      }${s.ret6m === null ? "" : `, ${formatPercent(s.ret6m)} over six months`}.`,
    );
  }
  if (s.rs3m !== null) {
    notes.push(
      `${s.rs3m >= 0 ? "Ahead of" : "Behind"} NIFTY 50 by ${formatLevelPercent(
        Math.abs(s.rs3m),
      )} over three months${regime.ret3m === null ? "" : `, against the index's ${formatPercent(regime.ret3m)}`}.`,
    );
  }
  if (s.fromHigh !== null) {
    notes.push(
      Math.abs(s.fromHigh) < 0.03
        ? "At or near its one-year high."
        : `${formatLevelPercent(Math.abs(s.fromHigh))} below its one-year high.`,
    );
  }
  if (s.vol !== null) {
    notes.push(
      `Annualised volatility ${formatLevelPercent(s.vol)} — ${
        s.vol > 0.4 ? "high" : s.vol > 0.26 ? "typical for a single name" : "subdued"
      }.`,
    );
  }
  if (s.sinceEntry !== null) {
    notes.push(`Holder is ${s.sinceEntry >= 0 ? "up" : "down"} ${formatLevelPercent(Math.abs(s.sinceEntry))} since entry.`);
  }
  notes.push(`${s.bars} daily bars available.`);
  if (s.bars < MIN_BARS) {
    notes.push(
      `Price history is thin (${s.bars} ${s.bars === 1 ? "session" : "sessions"}), so trend, momentum, relative strength and volatility cannot be measured. Do not infer them; lean on what you can search for and say that the price record is too short to judge on.`,
    );
  }

  return notes;
}

function readRegime(benchmark: SymbolHistory | null, quotes: QuoteMap): Regime {
  const series = benchmark ? closes(benchmark.bars) : [];
  if (series.length < MIN_BARS) {
    return { label: "Market backdrop unavailable", trendUp: null, ret3m: null, tone: "neutral" };
  }

  const live = quotes["^NSEI"]?.price ?? null;
  const marked = live && live > 0 ? [...series, live] : series;
  const ret3m = trailing(marked, 63);
  const window = Math.min(200, marked.length);
  let sum = 0;
  for (let i = marked.length - window; i < marked.length; i++) sum += marked[i];
  const trendUp = marked[marked.length - 1] > sum / window;
  const tail = ret3m === null ? "" : `, ${formatPercent(ret3m)} over three months`;

  return {
    trendUp,
    ret3m,
    tone: trendUp ? "gain" : "loss",
    label: `NIFTY 50 ${trendUp ? "above" : "below"} its long average${tail}`,
  };
}

/**
 * Sector weights over the holdings that *have* a sector.
 *
 * Unclassified holdings are left out rather than bucketed. The weights therefore
 * need not sum to 1, and `classifiedWeight` says how much of the basket they
 * cover — a reader looking at "Energy 40%" is entitled to know whether the other
 * 60% is other sectors or simply unknown.
 */
function rollUpSectors(holdings: MeasuredHolding[]): Book["sectors"] {
  const bySector = new Map<string, number>();
  for (const h of holdings) {
    if (h.weight === null || h.sector === UNCLASSIFIED) continue;
    bySector.set(h.sector, (bySector.get(h.sector) ?? 0) + h.weight);
  }
  return [...bySector.entries()]
    .map(([sector, weight]) => ({ sector, weight }))
    .sort((a, b) => b.weight - a.weight);
}

/** Every symbol a review needs bars for — the basket's holdings plus the bench. */
export function symbolsFor(basket: WatchlistSummary): string[] {
  const set = new Set<string>();
  for (const item of basket.items) if (item.symbol) set.add(toYahooSymbol(item));
  for (const candidate of BENCH) set.add(toYahooSymbol(candidate));
  return [...set].sort();
}
