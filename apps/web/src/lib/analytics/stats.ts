/**
 * The statistics the basket dashboard is built from.
 *
 * Everything here is pure, takes plain arrays of numbers, and follows the same
 * nullability discipline as `lib/watchlist/pnl.ts`: a figure that cannot be
 * computed from the data given comes back `null`, never `0`. A Sharpe ratio of
 * zero and a Sharpe ratio nobody could work out are different facts, and the
 * dashboard renders them differently.
 *
 * Two conventions hold throughout:
 *
 * - **Returns are simple, daily and arithmetic** (`v[i]/v[i-1] - 1`), which is
 *   what the standard ratios below are defined on. Log returns are used only
 *   where compounding has to be additive, and never mixed into the same figure.
 * - **Annualisation is √252 for risk and geometric for return.** Multiplying a
 *   daily mean by 252 overstates a compounded return; taking a daily σ times
 *   √252 is the accepted convention and is what every published Sharpe is
 *   quoted on.
 */

/** NSE sessions in a year, near enough. Every annualised figure uses this. */
export const TRADING_DAYS = 252;

/**
 * The risk-free rate the Sharpe and Sortino ratios subtract, annualised.
 *
 * 6% is roughly the 91-day T-bill through the period this product covers. It is
 * a constant rather than a fetched series on purpose: a rate that moves would
 * make yesterday's Sharpe irreproducible, and at these horizons the choice
 * moves the ratio far less than the choice of window does. Shown in the
 * dashboard's method note so the number is never quoted without it.
 */
export const RISK_FREE_ANNUAL = 0.06;

const DAILY_RF = RISK_FREE_ANNUAL / TRADING_DAYS;

// --- primitives ---------------------------------------------------------------

export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

/**
 * Sample standard deviation (n−1). The series here is a sample of a process,
 * not the whole population, and at 20-odd observations the difference between
 * the two divisors is visible in the third digit of a Sharpe ratio.
 */
export function stdev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  let acc = 0;
  for (const x of xs) acc += (x - m) ** 2;
  return Math.sqrt(acc / (xs.length - 1));
}

export function covariance(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = mean(xs.slice(0, n))!;
  const my = mean(ys.slice(0, n))!;
  let acc = 0;
  for (let i = 0; i < n; i++) acc += (xs[i] - mx) * (ys[i] - my);
  return acc / (n - 1);
}

export function correlation(xs: number[], ys: number[]): number | null {
  const cov = covariance(xs, ys);
  const sx = stdev(xs);
  const sy = stdev(ys);
  if (cov === null || !sx || !sy) return null;
  return cov / (sx * sy);
}

/** Daily simple returns from a level series. Non-positive levels break the ratio. */
export function returnsFrom(levels: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1];
    out.push(prev > 0 ? levels[i] / prev - 1 : 0);
  }
  return out;
}

// --- return ------------------------------------------------------------------

/** Total return over the whole series, as a fraction. */
export function totalReturn(levels: number[]): number | null {
  if (levels.length < 2) return null;
  const first = levels[0];
  return first > 0 ? levels[levels.length - 1] / first - 1 : null;
}

/**
 * Compound annual growth rate.
 *
 * Returns null under a month of history: annualising three weeks produces a
 * number like "412% a year" that is arithmetically correct and completely
 * misleading, and a dash is the honest rendering of it.
 */
export function cagr(levels: number[], calendarDays: number): number | null {
  const total = totalReturn(levels);
  if (total === null || calendarDays < 30) return null;
  const years = calendarDays / 365.25;
  const growth = 1 + total;
  if (growth <= 0) return null;
  return growth ** (1 / years) - 1;
}

// --- risk ---------------------------------------------------------------------

/** Annualised standard deviation of daily returns. */
export function volatility(returns: number[]): number | null {
  const sd = stdev(returns);
  return sd === null ? null : sd * Math.sqrt(TRADING_DAYS);
}

/** Excess return over the risk-free rate, per unit of total volatility. */
export function sharpe(returns: number[]): number | null {
  const m = mean(returns);
  const sd = stdev(returns);
  if (m === null || !sd) return null;
  return ((m - DAILY_RF) / sd) * Math.sqrt(TRADING_DAYS);
}

/**
 * Sharpe's downside-only sibling: the same excess return over the deviation of
 * the days that lost money. Upside volatility is not a risk anybody is trying
 * to avoid, and for a basket of momentum picks the two ratios can disagree
 * sharply — which is exactly why both are shown.
 */
export function sortino(returns: number[]): number | null {
  const m = mean(returns);
  if (m === null) return null;
  const downside = returns.filter((r) => r < DAILY_RF).map((r) => (r - DAILY_RF) ** 2);
  if (downside.length < 2) return null;
  const dd = Math.sqrt(mean(downside)!);
  if (!dd) return null;
  return ((m - DAILY_RF) / dd) * Math.sqrt(TRADING_DAYS);
}

export interface Drawdown {
  /** Depth as a negative fraction — −0.18 is "18% below the high water mark". */
  depth: number;
  peakIndex: number;
  troughIndex: number;
  /** Where the series first regained the peak, or null if it never has. */
  recoveryIndex: number | null;
}

/** The running distance below the high water mark, as negative fractions. */
export function drawdownSeries(levels: number[]): number[] {
  const out: number[] = [];
  let peak = -Infinity;
  for (const v of levels) {
    if (v > peak) peak = v;
    out.push(peak > 0 ? v / peak - 1 : 0);
  }
  return out;
}

/** The deepest peak-to-trough fall, and whether it has been recovered. */
export function maxDrawdown(levels: number[]): Drawdown | null {
  if (levels.length < 2) return null;

  let peak = levels[0];
  let peakIndex = 0;
  let worst: Drawdown | null = null;

  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > peak) {
      peak = levels[i];
      peakIndex = i;
      continue;
    }
    const depth = peak > 0 ? levels[i] / peak - 1 : 0;
    if (!worst || depth < worst.depth) {
      worst = { depth, peakIndex, troughIndex: i, recoveryIndex: null };
    }
  }

  if (!worst) return null;

  const peakValue = levels[worst.peakIndex];
  for (let i = worst.troughIndex + 1; i < levels.length; i++) {
    if (levels[i] >= peakValue) {
      worst.recoveryIndex = i;
      break;
    }
  }
  return worst;
}

/**
 * Historical value at risk: the loss the worst 5% of days exceeded. Historical
 * rather than parametric because daily equity returns have fatter tails than a
 * normal distribution, and a σ-based VaR reliably understates exactly the days
 * this figure exists to warn about.
 */
export function historicalVar(returns: number[], confidence = 0.95): number | null {
  if (returns.length < 20) return null;
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.max(0, Math.floor((1 - confidence) * sorted.length) - 1);
  return sorted[index];
}

/** Return per unit of worst-case pain. The ratio a drawdown-averse reader wants. */
export function calmar(cagrValue: number | null, drawdown: number | null): number | null {
  if (cagrValue === null || drawdown === null || drawdown >= 0) return null;
  return cagrValue / Math.abs(drawdown);
}

// --- against a benchmark -------------------------------------------------------

export interface BenchmarkFit {
  /** Sensitivity to the index: 1.2 means the basket moves 20% harder than it. */
  beta: number;
  /** Annualised Jensen's alpha — return the beta exposure does not explain. */
  alpha: number;
  correlation: number;
  /** Share of the basket's variance the index explains. */
  rSquared: number;
  /** Annualised σ of the return difference. */
  trackingError: number;
  /** Excess return per unit of tracking error. */
  informationRatio: number | null;
  /** Fraction of the index's rise the basket captured on its up days. */
  upCapture: number | null;
  downCapture: number | null;
  /** Share of days the basket beat the index. */
  hitRate: number;
  observations: number;
}

/**
 * Regresses the basket's daily returns on the benchmark's.
 *
 * Under 20 paired observations this returns null rather than a beta: a
 * regression through a fortnight of data produces a slope with a confidence
 * interval wide enough to contain any thesis you like, and the dashboard should
 * say "not enough history" rather than print it.
 */
export const MIN_REGRESSION_DAYS = 20;

export function fitBenchmark(returns: number[], benchmark: number[]): BenchmarkFit | null {
  const n = Math.min(returns.length, benchmark.length);
  if (n < MIN_REGRESSION_DAYS) return null;

  const r = returns.slice(returns.length - n);
  const b = benchmark.slice(benchmark.length - n);

  const varB = stdev(b);
  const cov = covariance(r, b);
  if (cov === null || !varB) return null;

  const beta = cov / varB ** 2;
  const mr = mean(r)!;
  const mb = mean(b)!;
  // Jensen's alpha, daily, then compounded up rather than multiplied — an
  // alpha of 4bp a day is 10.6% a year, not 10.1%.
  const dailyAlpha = mr - DAILY_RF - beta * (mb - DAILY_RF);
  const alpha = (1 + dailyAlpha) ** TRADING_DAYS - 1;

  const corr = correlation(r, b) ?? 0;
  const diff = r.map((v, i) => v - b[i]);
  const teDaily = stdev(diff);
  const trackingError = teDaily === null ? 0 : teDaily * Math.sqrt(TRADING_DAYS);
  const activeMean = mean(diff)!;

  // Capture ratios are sums, not means: the ratio of what the basket made on
  // the index's up days to what the index itself made on them.
  let upB = 0;
  let upR = 0;
  let downB = 0;
  let downR = 0;
  let wins = 0;
  for (let i = 0; i < n; i++) {
    if (b[i] > 0) {
      upB += b[i];
      upR += r[i];
    } else if (b[i] < 0) {
      downB += b[i];
      downR += r[i];
    }
    if (r[i] > b[i]) wins += 1;
  }

  return {
    beta,
    alpha,
    correlation: corr,
    rSquared: corr ** 2,
    trackingError,
    informationRatio: teDaily ? (activeMean / teDaily) * Math.sqrt(TRADING_DAYS) : null,
    upCapture: upB > 0 ? upR / upB : null,
    downCapture: downB < 0 ? downR / downB : null,
    hitRate: wins / n,
    observations: n,
  };
}

// --- rolling ------------------------------------------------------------------

/**
 * Maps a window function across a series, emitting null until the window fills.
 * The nulls are kept rather than dropped so the result indexes 1:1 against the
 * input — the chart needs to place these on the same dates.
 */
export function rolling(
  xs: number[],
  window: number,
  fn: (slice: number[], endIndex: number) => number | null,
): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = 0; i < xs.length; i++) {
    if (i + 1 < window) {
      out.push(null);
      continue;
    }
    out.push(fn(xs.slice(i + 1 - window, i + 1), i));
  }
  return out;
}

/**
 * The window every rolling figure on the dashboard uses.
 *
 * 63 sessions is a quarter — long enough that a rolling beta is estimated from
 * something rather than reproducing the daily noise, short enough to show a
 * regime change within a year of history. Shorter series step down to a month,
 * and anything under two months of data gets no rolling chart at all.
 */
export function rollingWindow(observations: number): number | null {
  if (observations >= 190) return 63;
  if (observations >= 63) return 21;
  return null;
}

// --- portfolio decomposition ---------------------------------------------------

/**
 * The correlation of every holding with every other, over the window where all
 * of them have data. This is the group question the individual charts cannot
 * answer: eight names that all move together are one position held eight times.
 */
export function correlationMatrix(columns: number[][]): number[][] {
  const n = columns.length;
  const out: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c = correlation(columns[i], columns[j]) ?? 0;
      out[i][j] = c;
      out[j][i] = c;
    }
  }
  return out;
}

export interface RiskDecomposition {
  /** Annualised σ of the weighted portfolio, from the covariance matrix. */
  portfolioVolatility: number;
  /** Weighted average of the holdings' own σ — what no diversification looks like. */
  weightedAverageVolatility: number;
  /** How much of that the correlations gave back. 1.0 is no benefit at all. */
  diversificationRatio: number;
  /** Each holding's share of portfolio variance, summing to 1. */
  riskShares: number[];
  /** Each holding's own annualised σ. */
  volatilities: number[];
  /** Mean off-diagonal correlation — the group's crowding, in one number. */
  averageCorrelation: number | null;
  observations: number;
}

/**
 * Splits the portfolio's volatility across its holdings.
 *
 * The share reported is the **marginal** contribution, `w_i · (Σw)_i / σ²`, not
 * the holding's own volatility scaled by its weight. The difference is the
 * whole point: a name can be 8% of the money and 25% of the risk because it is
 * volatile *and* correlated with everything else in the basket, and only the
 * marginal form shows that. The shares sum to exactly 1 by construction.
 */
export function decomposeRisk(columns: number[][], weights: number[]): RiskDecomposition | null {
  const n = columns.length;
  if (n === 0 || weights.length !== n) return null;
  const observations = Math.min(...columns.map((c) => c.length));
  if (observations < MIN_REGRESSION_DAYS) return null;

  const cov: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const c = covariance(columns[i], columns[j]) ?? 0;
      cov[i][j] = c;
      cov[j][i] = c;
    }
  }

  // (Σw)_i — the covariance of holding i with the portfolio as a whole.
  const sigmaW = cov.map((row) => row.reduce((acc, v, j) => acc + v * weights[j], 0));
  const variance = sigmaW.reduce((acc, v, i) => acc + v * weights[i], 0);
  if (variance <= 0) return null;

  const annualise = Math.sqrt(TRADING_DAYS);
  const volatilities = cov.map((row, i) => Math.sqrt(Math.max(row[i], 0)) * annualise);
  const portfolioVolatility = Math.sqrt(variance) * annualise;
  const weightedAverageVolatility = volatilities.reduce(
    (acc, v, i) => acc + v * Math.abs(weights[i]),
    0,
  );

  let corrSum = 0;
  let corrCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const denom = Math.sqrt(cov[i][i] * cov[j][j]);
      if (denom > 0) {
        corrSum += cov[i][j] / denom;
        corrCount += 1;
      }
    }
  }

  return {
    portfolioVolatility,
    weightedAverageVolatility,
    diversificationRatio:
      portfolioVolatility > 0 ? weightedAverageVolatility / portfolioVolatility : 1,
    riskShares: sigmaW.map((v, i) => (v * weights[i]) / variance),
    volatilities,
    averageCorrelation: corrCount ? corrSum / corrCount : null,
    observations,
  };
}

export interface Concentration {
  /** Herfindahl index of the weights — 1 is everything in one name. */
  hhi: number;
  /**
   * 1/HHI: how many equally-sized positions this basket actually behaves like.
   * Twelve holdings with an effective count of 3.4 is a three-stock bet with
   * nine names of decoration on it.
   */
  effectiveHoldings: number;
  /** Share of the money in the three largest positions. */
  topThreeWeight: number;
  largestWeight: number;
}

export function concentration(weights: number[]): Concentration | null {
  const total = weights.reduce((a, w) => a + w, 0);
  if (!weights.length || total <= 0) return null;

  const normalised = weights.map((w) => w / total).sort((a, b) => b - a);
  const hhi = normalised.reduce((acc, w) => acc + w * w, 0);
  return {
    hhi,
    effectiveHoldings: 1 / hhi,
    topThreeWeight: normalised.slice(0, 3).reduce((a, w) => a + w, 0),
    largestWeight: normalised[0],
  };
}
