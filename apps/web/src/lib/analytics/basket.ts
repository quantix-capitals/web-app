/**
 * Turns a basket's rows and a pile of daily bars into the model the dashboard
 * plots.
 *
 * The design decision that everything else follows from: **a basket is valued
 * as money, not as an average of percentages.** Each holding contributes
 * `cost × growth` in rupees, and every group figure — return, volatility, beta,
 * drawdown — is derived from the resulting one-dimensional value series. That
 * is what makes a ten-lakh position and a ten-thousand position count for what
 * they actually are, and it is the same rule `lib/watchlist/pnl.ts` follows for
 * the live figures, so the dashboard and the ledger can never disagree.
 *
 * Three subtleties the maths has to respect:
 *
 * 1. **Staggered entries.** Symbols joined a basket on different days. Before a
 *    holding's entry date its money is held at cost — it is cash, not a
 *    position — so the invested total stays constant and the return series
 *    isn't distorted by a name that wasn't there yet.
 * 2. **Splits.** The path is walked on Yahoo's *adjusted* close, anchored to
 *    the ledger's raw entry price: `value = cost × ac(t)/ac(entry)`. Walking
 *    the raw close instead would read a 1:5 split as an 80% loss.
 * 3. **The benchmark is a counterfactual, not a line.** "NIFTY 50" here means
 *    the same rupees, put into the index on the same days — which is the only
 *    comparison that answers "was picking these worth it?".
 * 4. **Both ends are anchored on the ledger, not on the bars.** The entry point
 *    is the ledger's cost, and the last point is the ledger's live quote —
 *    daily bars only supply the shape in between. Anchoring only the entry is
 *    what let the dashboard end on yesterday's close while the ledger ended on
 *    today's price, so the same basket read +2.91% on one tab and −1.41% on the
 *    other. See `applyLiveMark` below.
 */

import { toYahooSymbol } from "@stealth/shared";
import type { Bar, QuoteMap, SymbolHistory } from "@stealth/shared";
import type { WatchlistItemView } from "@/lib/watchlist/types";
import {
  cagr,
  calmar,
  concentration,
  correlation,
  correlationMatrix,
  decomposeRisk,
  drawdownSeries,
  fitBenchmark,
  historicalVar,
  maxDrawdown,
  mean,
  returnsFrom,
  rolling,
  rollingWindow,
  sharpe,
  sortino,
  stdev,
  totalReturn,
  volatility,
  type BenchmarkFit,
  type Concentration,
  type Drawdown,
  type RiskDecomposition,
} from "./stats";

/** NIFTY 50 on Yahoo. The one benchmark this dashboard compares against. */
export const BENCHMARK_SYMBOL = "^NSEI";
export const BENCHMARK_LABEL = "NIFTY 50";

/** Why a holding could not be plotted. Surfaced, never silently dropped. */
export type ExclusionReason = "no-baseline" | "no-history";

export interface Excluded {
  symbol: string;
  exchange: string;
  reason: ExclusionReason;
}

export interface HoldingSeries {
  id: string;
  symbol: string;
  exchange: string;
  name: string | null;
  quantity: number;
  /** Rupees committed: `quantity × entry price`. */
  cost: number;
  entryPrice: number;
  entryIndex: number;
  entryAt: number;
  /** Value in rupees on every date of the spine, cost-held before entry. */
  value: number[];
}

/** Everything derived once from the raw bars, before a range is chosen. */
export interface BasketSeries {
  /** Trading days, epoch ms, ascending. */
  dates: number[];
  /** Basket value in rupees. */
  value: number[];
  /** The same rupees in the index, entered on the same days. */
  benchmarkValue: number[];
  /** Index level itself, for the rebasing a windowed view needs. */
  benchmarkLevel: Array<number | null>;
  /** Traded value across the constituents, in rupees. Null on days none printed. */
  turnover: Array<number | null>;
  holdings: HoldingSeries[];
  invested: number;
  excluded: Excluded[];
  benchmarkAvailable: boolean;
  /** Holdings whose last point is a live quote rather than the last close. */
  livePriced: number;
}

export interface HoldingStat {
  id: string;
  symbol: string;
  exchange: string;
  name: string | null;
  quantity: number;
  weight: number;
  entryWeight: number;
  cost: number;
  marketValue: number;
  /** Rupees this holding added to the basket's P&L over the window. */
  contribution: number;
  /** The holding's own return over the window. */
  returnPct: number | null;
  volatility: number | null;
  beta: number | null;
  /** Correlation with the rest of the basket — how much it is just more of the same. */
  correlationToBasket: number | null;
  maxDrawdown: number | null;
  /** Share of the basket's variance, from the marginal risk decomposition. */
  riskShare: number | null;
  /** Rebased to 100 at the window's start, for the small multiples. */
  indexed: number[];
  /** True while the window starts before this holding was added. */
  partial: boolean;
}

export interface MonthlyReturn {
  /** `YYYY-MM`. */
  month: string;
  label: string;
  basket: number;
  benchmark: number | null;
}

export interface BasketSummary {
  invested: number;
  marketValue: number;
  gain: number;
  returnPct: number | null;
  benchmarkReturnPct: number | null;
  /** Basket return minus index return — the number the whole page exists for. */
  excessPct: number | null;
  /** What the same money in the index would be worth now. */
  benchmarkValue: number | null;
  cagr: number | null;
  benchmarkCagr: number | null;
  volatility: number | null;
  benchmarkVolatility: number | null;
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
  drawdown: Drawdown | null;
  benchmarkDrawdownDepth: number | null;
  var95: number | null;
  bestDay: number | null;
  worstDay: number | null;
  positiveDays: number;
  tradingDays: number;
  calendarDays: number;
  fit: BenchmarkFit | null;
  /** The basket's value at the window's start. Equals `invested` on "since entry". */
  openingValue: number;
  /** True while every holding's last point is a live quote. */
  livePriced: boolean;
}

export interface BasketAnalytics {
  dates: number[];
  value: number[];
  /** Index counterfactual, rebased so it starts level with the basket. */
  benchmarkValue: Array<number | null>;
  turnover: Array<number | null>;
  returns: number[];
  benchmarkReturns: number[];
  drawdown: number[];
  benchmarkDrawdown: Array<number | null>;
  /** Cumulative basket return minus index return, in percentage points. */
  excess: Array<number | null>;
  rollingWindowDays: number | null;
  rollingVolatility: Array<number | null>;
  rollingBenchmarkVolatility: Array<number | null>;
  rollingBeta: Array<number | null>;
  rollingCorrelation: Array<number | null>;
  monthly: MonthlyReturn[];
  /** Daily [index return, basket return] pairs, for the beta scatter. */
  scatter: Array<[number, number]>;
  regression: { slope: number; intercept: number } | null;
  holdings: HoldingStat[];
  correlations: { symbols: string[]; matrix: number[][]; observations: number } | null;
  risk: RiskDecomposition | null;
  concentration: Concentration | null;
  summary: BasketSummary;
  excluded: Excluded[];
  benchmarkAvailable: boolean;
}

// --- building the series --------------------------------------------------------

const DAY_MS = 86_400_000;

/**
 * The UTC midnight a bar belongs to.
 *
 * Safe for the NSE specifically: a 09:15 IST open is 03:45 UTC, so the UTC and
 * exchange dates never disagree. It would not be safe for a market that opens
 * before UTC midnight, and this app trades one country.
 */
function dayOf(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

function barsByDay(bars: Bar[]): Map<number, Bar> {
  const map = new Map<number, Bar>();
  for (const bar of bars) {
    if (bar.ac !== null && bar.ac > 0) map.set(dayOf(bar.t), bar);
  }
  return map;
}

/** The day a holding's baseline was struck — its entry date, else when it landed. */
function entryDayOf(item: WatchlistItemView): number {
  return dayOf(new Date(item.entryAt ?? item.addedAt).getTime());
}

/**
 * Aligns every holding and the benchmark onto one trading calendar and values
 * the basket along it.
 *
 * The spine is the union of every symbol's trading days rather than any one
 * symbol's: a holding suspended for a week should leave the other lines
 * intact, and forward-filling its last close across the gap is what a broker's
 * statement would show too.
 */
export function buildSeries(
  items: WatchlistItemView[],
  history: SymbolHistory[],
  benchmarkBars: Bar[] | null,
  quotes: QuoteMap = {},
): BasketSeries | null {
  const byRequested = new Map(history.map((h) => [h.requested, h] as const));
  const excluded: Excluded[] = [];

  const usable: Array<{ item: WatchlistItemView; bars: Map<number, Bar> }> = [];
  for (const item of items) {
    if (!item.symbol) continue;
    if (item.entryPrice === null || item.entryPrice <= 0) {
      excluded.push({ symbol: item.symbol, exchange: item.exchange, reason: "no-baseline" });
      continue;
    }
    const found = byRequested.get(toYahooSymbol({ symbol: item.symbol, exchange: item.exchange }));
    const bars = found ? barsByDay(found.bars) : new Map<number, Bar>();
    if (!bars.size) {
      excluded.push({ symbol: item.symbol, exchange: item.exchange, reason: "no-history" });
      continue;
    }
    usable.push({ item, bars });
  }

  if (!usable.length) return null;

  const inception = Math.min(...usable.map(({ item }) => entryDayOf(item)));
  const benchmark = benchmarkBars?.length ? barsByDay(benchmarkBars) : null;

  const days = new Set<number>();
  for (const { bars } of usable) for (const day of bars.keys()) days.add(day);
  if (benchmark) for (const day of benchmark.keys()) days.add(day);
  const dates = [...days].filter((d) => d >= inception).sort((a, b) => a - b);
  if (dates.length < 2) return null;

  // --- per-holding value paths -------------------------------------------------
  const holdings: HoldingSeries[] = [];
  let livePriced = 0;
  for (const { item, bars } of usable) {
    const entryAt = entryDayOf(item);
    const cost = item.quantity * item.entryPrice!;

    // The adjusted close on the entry day is the denominator of every later
    // growth factor, so it is looked up with the same forward-fill the path
    // uses — an entry struck on a holiday still needs a divisor.
    const entryAdj = lookupAdjusted(bars, dates, entryAt);
    if (entryAdj === null) {
      excluded.push({ symbol: item.symbol, exchange: item.exchange, reason: "no-history" });
      continue;
    }

    let entryIndex = dates.findIndex((d) => d >= entryAt);
    if (entryIndex < 0) entryIndex = dates.length - 1;

    // Growth on the adjusted close, anchored at the entry day, forward-filled
    // across sessions this symbol did not print.
    const growth: number[] = [];
    let last = entryAdj;
    for (let i = 0; i < dates.length; i++) {
      const bar = bars.get(dates[i]);
      if (bar?.ac) last = bar.ac;
      growth.push(last / entryAdj);
    }

    const value = growth.map((g, i) => (i < entryIndex ? cost : cost * g));
    if (applyLiveMark(value, entryIndex, item.quantity, livePriceOf(item, quotes))) livePriced += 1;

    holdings.push({
      id: item.id,
      symbol: item.symbol,
      exchange: item.exchange,
      name: item.name,
      quantity: item.quantity,
      cost,
      entryPrice: item.entryPrice!,
      entryIndex,
      entryAt,
      value,
    });
  }

  if (!holdings.length) return null;

  // --- the group ---------------------------------------------------------------
  const invested = holdings.reduce((acc, h) => acc + h.cost, 0);
  const value = dates.map((_, i) => holdings.reduce((acc, h) => acc + h.value[i], 0));

  // --- the benchmark counterfactual, entered holding by holding ----------------
  const benchmarkLevel: Array<number | null> = dates.map((d) => benchmark?.get(d)?.ac ?? null);
  forwardFill(benchmarkLevel);

  // The index has to be marked at the same instant the basket is, or the gap
  // between them reads a difference in clocks as a difference in performance.
  // The quote is a raw level, so it is carried onto the adjusted scale the
  // entry levels live on before it replaces the last close.
  const benchmarkLive = quotes[BENCHMARK_SYMBOL];
  if (benchmark && benchmarkLive && benchmarkLive.price > 0 && benchmarkLevel.length) {
    const latest = latestBar(benchmark);
    const scale = latest?.ac && latest.c ? latest.ac / latest.c : 1;
    benchmarkLevel[benchmarkLevel.length - 1] = benchmarkLive.price * scale;
  }

  let benchmarkValue: number[] = [];
  let benchmarkAvailable = false;
  if (benchmark) {
    const entryLevels = holdings.map((h) => lookupAdjusted(benchmark, dates, h.entryAt));
    benchmarkAvailable = entryLevels.every((l) => l !== null) && benchmarkLevel.some((l) => l);
    if (benchmarkAvailable) {
      benchmarkValue = dates.map((_, i) => {
        const level = benchmarkLevel[i];
        return holdings.reduce((acc, h, k) => {
          if (i < h.entryIndex || level === null) return acc + h.cost;
          return acc + h.cost * (level / entryLevels[k]!);
        }, 0);
      });
    }
  }

  // --- turnover ----------------------------------------------------------------
  // Not forward-filled: a day with no print has no volume, and carrying
  // yesterday's over would draw a bar for a session that never happened.
  const turnover: Array<number | null> = dates.map((day, i) => {
    let total = 0;
    let seen = false;
    for (const { item, bars } of usable) {
      const holding = holdings.find((h) => h.id === item.id);
      if (!holding || i < holding.entryIndex) continue;
      const bar = bars.get(day);
      if (bar?.v && bar.c) {
        total += bar.v * bar.c;
        seen = true;
      }
    }
    return seen ? total : null;
  });

  return {
    dates,
    value,
    benchmarkValue,
    benchmarkLevel,
    turnover,
    holdings,
    invested,
    excluded,
    benchmarkAvailable,
    livePriced,
  };
}

/**
 * Re-anchors a holding's value path on the live quote.
 *
 * The daily bars end on the last close; the ledger marks the row at the live
 * price. Scaling the post-entry segment so its last point is `quantity × live`
 * makes the dashboard's "Value now" the ledger's "Total value" by construction.
 *
 * Scaling by a constant leaves every interior daily return untouched — the only
 * return it changes is the first one after entry, which is exactly where the
 * gap between the fill price and that session's close belongs. Left unanchored,
 * that gap became a permanent offset between the two views.
 *
 * Returns whether a live mark was available to apply.
 */
function applyLiveMark(
  value: number[],
  entryIndex: number,
  quantity: number,
  live: number | null,
): boolean {
  if (live === null) return false;
  const last = value.length - 1;
  const target = quantity * live;

  // Entered on the final session: there is no path to scale, only a mark.
  if (last <= entryIndex) {
    value[last] = target;
    return true;
  }
  if (!(value[last] > 0)) return false;

  const factor = target / value[last];
  for (let i = entryIndex + 1; i <= last; i++) value[i] *= factor;
  return true;
}

/** The live price the ledger marks this row at, when the feed has one. */
function livePriceOf(item: WatchlistItemView, quotes: QuoteMap): number | null {
  const quote = quotes[toYahooSymbol({ symbol: item.symbol, exchange: item.exchange })];
  return quote && quote.price > 0 ? quote.price : null;
}

/** The most recent bar with an adjusted close. */
function latestBar(bars: Map<number, Bar>): Bar | null {
  let best: Bar | null = null;
  let bestDay = -Infinity;
  for (const [day, bar] of bars) {
    if (bar.ac && day > bestDay) {
      best = bar;
      bestDay = day;
    }
  }
  return best;
}

/** The last adjusted close on or before `day`, else the first one after it. */
function lookupAdjusted(bars: Map<number, Bar>, dates: number[], day: number): number | null {
  let best: number | null = null;
  let bestDay = -Infinity;
  let earliest: number | null = null;
  let earliestDay = Infinity;

  for (const [d, bar] of bars) {
    if (!bar.ac) continue;
    if (d <= day && d > bestDay) {
      best = bar.ac;
      bestDay = d;
    }
    if (d > day && d < earliestDay) {
      earliest = bar.ac;
      earliestDay = d;
    }
  }
  void dates;
  return best ?? earliest;
}

function forwardFill(xs: Array<number | null>) {
  let last: number | null = null;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] !== null) last = xs[i];
    else xs[i] = last;
  }
}

// --- windowing ------------------------------------------------------------------

export type RangeId = "1m" | "3m" | "6m" | "1y" | "all";

export const RANGES: Array<{ id: RangeId; label: string; days: number | null }> = [
  { id: "1m", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 91 },
  { id: "6m", label: "6M", days: 182 },
  { id: "1y", label: "1Y", days: 365 },
  { id: "all", label: "Since entry", days: null },
];

/** The first spine index inside a range. Falls back to the whole series. */
export function rangeStart(dates: number[], range: RangeId): number {
  const spec = RANGES.find((r) => r.id === range);
  if (!spec?.days) return 0;
  const cutoff = dates[dates.length - 1] - spec.days * DAY_MS;
  const index = dates.findIndex((d) => d >= cutoff);
  // A range shorter than two sessions of data is not a range; show everything
  // rather than a chart with one point on it.
  if (index < 0 || dates.length - index < 3) return 0;
  return index;
}

// --- the analysis ----------------------------------------------------------------

/**
 * Computes every figure the dashboard shows, over one window of the series.
 *
 * The benchmark is *rebased* to the window rather than re-derived: within a
 * window that starts after inception, the staggered counterfactual has the same
 * shape as the index itself, so scaling it to start level with the basket is
 * both correct and the only way the two lines answer the same question.
 */
export function analyse(series: BasketSeries, from: number): BasketAnalytics {
  const dates = series.dates.slice(from);
  const value = series.value.slice(from);
  const turnover = series.turnover.slice(from);

  const returns = returnsFrom(value);
  const drawdown = drawdownSeries(value);

  const hasBenchmark = series.benchmarkAvailable && series.benchmarkValue.length > 0;
  const rawBench = hasBenchmark ? series.benchmarkValue.slice(from) : [];
  const scale = hasBenchmark && rawBench[0] > 0 ? value[0] / rawBench[0] : 1;
  const benchmarkValue: Array<number | null> = hasBenchmark
    ? rawBench.map((v) => v * scale)
    : dates.map(() => null);
  const benchmarkReturns = hasBenchmark ? returnsFrom(rawBench) : [];
  const benchmarkDrawdown: Array<number | null> = hasBenchmark
    ? drawdownSeries(rawBench)
    : dates.map(() => null);

  const basketReturn = totalReturn(value);
  const benchmarkReturn = hasBenchmark ? totalReturn(rawBench) : null;

  // Cumulative relative performance, in percentage points, from a common start.
  const excess: Array<number | null> = hasBenchmark
    ? value.map((v, i) => {
        if (!value[0] || !rawBench[0]) return null;
        return v / value[0] - rawBench[i] / rawBench[0];
      })
    : dates.map(() => null);

  const calendarDays = Math.max(1, Math.round((dates[dates.length - 1] - dates[0]) / DAY_MS));
  const fit = hasBenchmark ? fitBenchmark(returns, benchmarkReturns) : null;
  const dd = maxDrawdown(value);
  const cagrValue = cagr(value, calendarDays);

  // --- rolling ------------------------------------------------------------------
  const window = rollingWindow(returns.length);
  const pad = <T,>(xs: T[]): Array<T | null> => [null, ...xs];
  const rollingVolatility = window
    ? pad(rolling(returns, window, (s) => volatility(s)))
    : dates.map(() => null);
  const rollingBenchmarkVolatility =
    window && hasBenchmark
      ? pad(rolling(benchmarkReturns, window, (s) => volatility(s)))
      : dates.map(() => null);
  const rollingBeta =
    window && hasBenchmark
      ? pad(
          rolling(returns, window, (slice, end) => {
            const b = benchmarkReturns.slice(end + 1 - window, end + 1);
            const sd = stdev(b);
            if (!sd) return null;
            const c = correlation(slice, b);
            const sr = stdev(slice);
            return c === null || sr === null ? null : (c * sr) / sd;
          }),
        )
      : dates.map(() => null);
  const rollingCorrelation =
    window && hasBenchmark
      ? pad(
          rolling(returns, window, (slice, end) =>
            correlation(slice, benchmarkReturns.slice(end + 1 - window, end + 1)),
          ),
        )
      : dates.map(() => null);

  // --- holdings -----------------------------------------------------------------
  const holdingWindows = series.holdings.map((h) => h.value.slice(from));
  const marketValue = value[value.length - 1];
  const columns = holdingWindows.map((v) => returnsFrom(v));
  const weights = holdingWindows.map((v) => v[v.length - 1] / marketValue);
  const risk = decomposeRisk(columns, weights);

  const holdings: HoldingStat[] = series.holdings.map((h, k) => {
    const path = holdingWindows[k];
    const start = path[0];
    const end = path[path.length - 1];
    const rets = columns[k];
    const own = maxDrawdown(path);
    return {
      id: h.id,
      symbol: h.symbol,
      exchange: h.exchange,
      name: h.name,
      quantity: h.quantity,
      weight: end / marketValue,
      entryWeight: h.cost / series.invested,
      cost: h.cost,
      marketValue: end,
      contribution: end - start,
      returnPct: start > 0 ? end / start - 1 : null,
      volatility: volatility(rets),
      beta: hasBenchmark ? betaOf(rets, benchmarkReturns) : null,
      correlationToBasket: correlation(rets, returns),
      maxDrawdown: own?.depth ?? null,
      riskShare: risk ? risk.riskShares[k] : null,
      indexed: start > 0 ? path.map((v) => (v / start) * 100) : path.map(() => 100),
      partial: h.entryIndex > from,
    };
  });

  // --- correlations between holdings ---------------------------------------------
  // Only over the window where every holding has a return, so no cell in the
  // matrix is computed from a different sample than its neighbour.
  const commonFrom = Math.max(...series.holdings.map((h) => h.entryIndex), from);
  const commonColumns = series.holdings.map((h) => returnsFrom(h.value.slice(commonFrom)));
  const commonObservations = commonColumns.length ? Math.min(...commonColumns.map((c) => c.length)) : 0;
  const correlations =
    series.holdings.length >= 2 && commonObservations >= 20
      ? {
          symbols: series.holdings.map((h) => h.symbol),
          matrix: correlationMatrix(commonColumns),
          observations: commonObservations,
        }
      : null;

  return {
    dates,
    value,
    benchmarkValue,
    turnover,
    returns,
    benchmarkReturns,
    drawdown,
    benchmarkDrawdown,
    excess,
    rollingWindowDays: window,
    rollingVolatility,
    rollingBenchmarkVolatility,
    rollingBeta,
    rollingCorrelation,
    monthly: monthlyReturns(dates, value, hasBenchmark ? rawBench : null),
    scatter: hasBenchmark ? benchmarkReturns.map((b, i) => [b, returns[i]] as [number, number]) : [],
    regression: hasBenchmark && fit ? { slope: fit.beta, intercept: interceptOf(returns, benchmarkReturns, fit.beta) } : null,
    holdings,
    correlations,
    risk,
    concentration: concentration(holdings.map((h) => h.marketValue)),
    excluded: series.excluded,
    benchmarkAvailable: hasBenchmark,
    summary: {
      invested: series.invested,
      marketValue,
      openingValue: value[0],
      livePriced: series.livePriced === series.holdings.length,
      // Both figures are measured over the *window*, so the percentage is
      // always the money divided by the opening mark. On "since entry" the
      // opening mark is the cost of the basket — every holding is held at cost
      // before its entry — so this is the ledger's P&L to the rupee.
      gain: marketValue - value[0],
      returnPct: basketReturn,
      benchmarkReturnPct: benchmarkReturn,
      excessPct:
        basketReturn !== null && benchmarkReturn !== null ? basketReturn - benchmarkReturn : null,
      benchmarkValue: hasBenchmark ? benchmarkValue[benchmarkValue.length - 1] : null,
      cagr: cagrValue,
      benchmarkCagr: hasBenchmark ? cagr(rawBench, calendarDays) : null,
      volatility: volatility(returns),
      benchmarkVolatility: hasBenchmark ? volatility(benchmarkReturns) : null,
      sharpe: sharpe(returns),
      sortino: sortino(returns),
      calmar: calmar(cagrValue, dd?.depth ?? null),
      drawdown: dd,
      benchmarkDrawdownDepth: hasBenchmark ? (maxDrawdown(rawBench)?.depth ?? null) : null,
      var95: historicalVar(returns),
      bestDay: returns.length ? Math.max(...returns) : null,
      worstDay: returns.length ? Math.min(...returns) : null,
      positiveDays: returns.filter((r) => r > 0).length,
      tradingDays: dates.length,
      calendarDays,
      fit,
    },
  };
}

function betaOf(returns: number[], benchmark: number[]): number | null {
  const n = Math.min(returns.length, benchmark.length);
  if (n < 20) return null;
  const r = returns.slice(returns.length - n);
  const b = benchmark.slice(benchmark.length - n);
  const sd = stdev(b);
  const c = correlation(r, b);
  const sr = stdev(r);
  if (!sd || c === null || sr === null) return null;
  return (c * sr) / sd;
}

function interceptOf(returns: number[], benchmark: number[], slope: number): number {
  const n = Math.min(returns.length, benchmark.length);
  const mr = mean(returns.slice(returns.length - n)) ?? 0;
  const mb = mean(benchmark.slice(benchmark.length - n)) ?? 0;
  return mr - slope * mb;
}

/**
 * Calendar-month returns, taken from the value series rather than compounded
 * from daily returns — the two agree to the fifth decimal, and reading the
 * month's first and last valuation is the version anyone can check by hand.
 */
function monthlyReturns(
  dates: number[],
  value: number[],
  benchmark: number[] | null,
): MonthlyReturn[] {
  const out: MonthlyReturn[] = [];
  let monthStart = 0;

  for (let i = 1; i <= dates.length; i++) {
    const ending = i === dates.length;
    const changed = !ending && monthKey(dates[i]) !== monthKey(dates[monthStart]);
    if (!ending && !changed) continue;

    const last = i - 1;
    // The opening mark is the previous month's close, so a month's return is
    // measured from where the last one actually ended.
    const openIndex = monthStart === 0 ? 0 : monthStart - 1;
    if (value[openIndex] > 0 && last > openIndex) {
      out.push({
        month: monthKey(dates[monthStart]),
        label: new Date(dates[monthStart]).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
          timeZone: "UTC",
        }),
        basket: value[last] / value[openIndex] - 1,
        benchmark:
          benchmark && benchmark[openIndex] > 0 ? benchmark[last] / benchmark[openIndex] - 1 : null,
      });
    }
    monthStart = i;
  }

  return out;
}

function monthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7);
}
