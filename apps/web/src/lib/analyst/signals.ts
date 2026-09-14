/**
 * Bars in, measurements out. No opinions live here — `review.ts` forms those.
 *
 * The series every figure is computed on is the **adjusted** close, for the same
 * reason `lib/analytics/basket.ts` walks it: a 1:5 split reads as an 80% crash
 * on the raw close, and a holding that split would be sold by any momentum rule
 * naive enough to look at `c`.
 *
 * Windows are counted in *bars*, not in calendar days, and a window longer than
 * the history available returns `null` rather than quietly shortening itself.
 * "Three-month momentum" computed over five weeks is not a weaker signal, it is
 * a different one wearing the same label.
 */

import { returnsFrom, stdev, TRADING_DAYS } from "@/lib/analytics/stats";
import type { Bar } from "@stealth/shared";
import type { Signals } from "./types";

/** Bars in a trailing month, quarter, half-year. NSE sessions, near enough. */
const MONTH = 21;
const QUARTER = 63;
const HALF = 126;

/** The window the drawdown and the volatility are measured over. */
const YEAR = TRADING_DAYS;
const VOL_WINDOW = 60;

/**
 * Below this there is not enough series to say anything, and the agent says so
 * instead of scoring noise. Two months of bars is the floor for a 1-month
 * return plus the average it is read against.
 */
export const MIN_BARS = 45;

/** The adjusted closes, holidays and halted sessions dropped. */
export function closes(bars: Bar[]): number[] {
  const out: number[] = [];
  for (const bar of bars) {
    const value = bar.ac ?? bar.c;
    if (value !== null && value > 0) out.push(value);
  }
  return out;
}

/** Trailing return over `window` bars, or `null` if the series is shorter. */
export function trailing(series: number[], window: number): number | null {
  if (series.length <= window) return null;
  const from = series[series.length - 1 - window];
  const to = series[series.length - 1];
  if (!from) return null;
  return to / from - 1;
}

/** Simple moving average of the last `window` bars. */
export function sma(series: number[], window: number): number | null {
  if (series.length < window) return null;
  let sum = 0;
  for (let i = series.length - window; i < series.length; i++) sum += series[i];
  return sum / window;
}

/**
 * Annualised volatility over the trailing window.
 *
 * √252 on a daily σ, which is the convention every quoted volatility uses —
 * see the note at the top of `lib/analytics/stats.ts`.
 */
export function annualVol(series: number[], window = VOL_WINDOW): number | null {
  if (series.length < 20) return null;
  const tail = series.slice(Math.max(0, series.length - window - 1));
  const daily = stdev(returnsFrom(tail));
  return daily === null ? null : daily * Math.sqrt(TRADING_DAYS);
}

/** Drawdown from the highest close in the window, as a negative fraction. */
export function fromHigh(series: number[], window = YEAR): number | null {
  if (series.length < 2) return null;
  const tail = series.slice(Math.max(0, series.length - window));
  const peak = Math.max(...tail);
  if (!peak) return null;
  return tail[tail.length - 1] / peak - 1;
}

/**
 * Every measurement for one symbol.
 *
 * `livePrice` is the ledger's own mark — the same quote the table beside this
 * sidebar is showing — and it is what `price` and `sinceEntry` are built from.
 * Anchoring on the last *bar* instead is what would let the agent recommend a
 * sell on yesterday's close while the row next to it shows today's rally.
 */
export function computeSignals({
  bars,
  livePrice,
  entryPrice,
  benchmarkRet3m,
}: {
  bars: Bar[];
  livePrice: number | null;
  entryPrice: number | null;
  benchmarkRet3m: number | null;
}): Signals {
  const series = closes(bars);
  // The live mark extends the series rather than replacing its last point: the
  // averages below should see today, and the close it would overwrite is a real
  // session that belongs in the 200-day mean.
  const marked = livePrice !== null && livePrice > 0 ? [...series, livePrice] : series;
  const price = marked.length ? marked[marked.length - 1] : null;

  const sma50 = sma(marked, 50);
  const sma200 = sma(marked, 200);
  const ret3m = trailing(marked, QUARTER);

  return {
    price,
    ret1m: trailing(marked, MONTH),
    ret3m,
    ret6m: trailing(marked, HALF),
    sinceEntry:
      price !== null && entryPrice !== null && entryPrice > 0 ? price / entryPrice - 1 : null,
    vsSma50: price !== null && sma50 ? price / sma50 - 1 : null,
    vsSma200: price !== null && sma200 ? price / sma200 - 1 : null,
    trendUp: sma50 !== null && sma200 !== null ? sma50 > sma200 : null,
    fromHigh: fromHigh(marked),
    vol: annualVol(marked),
    rs3m: ret3m !== null && benchmarkRet3m !== null ? ret3m - benchmarkRet3m : null,
    bars: series.length,
  };
}
