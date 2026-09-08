/**
 * Yahoo Finance calls. SERVER ONLY — this hits an unofficial, unauthenticated
 * upstream that sets cookies and sends no CORS headers, so it has to be
 * proxied through the `market` function rather than called from the browser.
 *
 * `yahoo-finance2` validates the shape of Yahoo's responses against its own
 * schema and can throw when Yahoo adds or renames a field — a working quote
 * turning into a 502 the day Yahoo ships a change we didn't ask for. Every
 * call below passes `{ validateResult: false }` and reads only the handful
 * of fields this app actually uses, so an upstream schema drift degrades a
 * field to `undefined` instead of failing the whole request.
 */

import YahooFinance from "npm:yahoo-finance2@^4.0.2";
import { fromYahooSymbol, toYahooSymbol } from "../../../packages/shared/src/symbols.ts";
import type {
  Bar,
  BaselinePrice,
  Quote,
  SymbolHistory,
  SymbolMatch,
} from "../../../packages/shared/src/types.ts";

// One module-level instance so the cookie/crumb Yahoo requires is fetched
// once, not per call.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const NO_VALIDATE = { validateResult: false } as const;

// --- TTL cache ---------------------------------------------------------------
// Best-effort only — a stampede guard for several baskets sharing symbols on
// one page load. Correctness never depends on it: it dies on HMR and on
// serverless scale-out, and every reader tolerates a miss.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const quoteCache = new Map<string, CacheEntry<Quote | null>>();
const QUOTE_TTL_MS = 20_000;

const searchCache = new Map<string, CacheEntry<SymbolMatch[]>>();
const SEARCH_TTL_MS = 5 * 60_000;

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// --- quotes -------------------------------------------------------------------

const CHUNK_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Fetches quotes for a set of Yahoo symbols. Yahoo omits symbols it doesn't
 * recognise rather than erroring on them, so `missing` is a set difference,
 * not something thrown. Each miss is retried once as the other Indian
 * exchange (`.NS` → `.BO`) before being given up on.
 */
export async function getQuotes(
  yahooSymbols: string[],
): Promise<{ quotes: Quote[]; missing: string[] }> {
  const unique = [...new Set(yahooSymbols)];
  const asOf = new Date().toISOString();

  const quotes: Quote[] = [];
  const stillMissing: string[] = [];
  const toFetch: string[] = [];

  for (const sym of unique) {
    const cached = cacheGet(quoteCache, sym);
    if (cached === undefined) {
      toFetch.push(sym);
    } else if (cached !== null) {
      quotes.push(cached);
    } else {
      stillMissing.push(sym);
    }
  }

  if (toFetch.length) {
    const results = await Promise.all(
      chunk(toFetch, CHUNK_SIZE).map((batch) => fetchQuoteBatch(batch)),
    );
    const bySymbol = new Map(results.flat().map((q) => [q.symbol, q] as const));

    for (const sym of toFetch) {
      const raw = bySymbol.get(sym);
      const shaped = raw ? shapeQuote(raw, asOf) : null;
      cacheSet(quoteCache, sym, shaped, QUOTE_TTL_MS);
      if (shaped) quotes.push(shaped);
      else stillMissing.push(sym);
    }
  }

  // Retry each miss on the other Indian exchange before giving up.
  const retried = await retryOnOtherExchange(stillMissing, asOf);
  quotes.push(...retried.quotes);

  return { quotes, missing: retried.missing };
}

/**
 * Yahoo hands out 429s in short bursts — a page that polls quotes while the
 * user is also adding a symbol will trip one. A single retry after a pause
 * clears almost all of them; anything past that is a real rate limit and is
 * rethrown for the caller to report.
 */
async function fetchQuoteBatch(symbols: string[]) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await yf.quote(symbols, {}, NO_VALIDATE);
    } catch (err) {
      if (!isRateLimited(err)) {
        // A malformed batch shouldn't sink every symbol in it — treat as "none found".
        return [];
      }
      if (attempt >= 1) throw err;
      await sleep(700);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryOnOtherExchange(
  missing: string[],
  asOf: string,
): Promise<{ quotes: Quote[]; missing: string[] }> {
  const quotes: Quote[] = [];
  const stillMissing: string[] = [];
  const retryTargets: Array<{ original: string; retry: string }> = [];

  for (const sym of missing) {
    const other = otherExchangeSymbol(sym);
    if (other) retryTargets.push({ original: sym, retry: other });
    else stillMissing.push(sym);
  }

  if (retryTargets.length) {
    const results = await Promise.all(
      chunk(
        retryTargets.map((t) => t.retry),
        CHUNK_SIZE,
      ).map((batch) => fetchQuoteBatch(batch)),
    );
    const bySymbol = new Map(results.flat().map((q) => [q.symbol, q] as const));

    for (const { original, retry } of retryTargets) {
      const raw = bySymbol.get(retry);
      if (raw) quotes.push(shapeQuote(raw, asOf));
      else stillMissing.push(original);
    }
  }

  return { quotes, missing: stillMissing };
}

function otherExchangeSymbol(yahooSymbol: string): string | null {
  const { symbol, exchange } = fromYahooSymbol(yahooSymbol);
  if (exchange === "NSE") return toYahooSymbol({ symbol, exchange: "BSE" });
  if (exchange === "BSE") return toYahooSymbol({ symbol, exchange: "NSE" });
  return null;
}

// deno-lint-ignore no-explicit-any
function shapeQuote(raw: any, asOf: string): Quote {
  const price = raw.regularMarketPrice ?? null;
  const previousClose = raw.regularMarketPreviousClose ?? null;
  return {
    symbol: raw.symbol,
    price: price ?? 0,
    previousClose,
    dayChange: raw.regularMarketChange ?? null,
    dayChangePercent:
      typeof raw.regularMarketChangePercent === "number"
        ? raw.regularMarketChangePercent / 100
        : null,
    currency: raw.currency ?? null,
    marketState: raw.marketState ?? null,
    asOf,
  };
}

function isRateLimited(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /429|rate limit|too many/i.test(message);
}

// --- historical close ---------------------------------------------------------

/**
 * The last daily close on or before `isoDate`. A 7-day lookback absorbs
 * weekends, holidays and a scan date that lands on a non-trading day.
 * Reads the raw `close`, not `adjclose` — the entry price should be the
 * number that was actually on the screen that day, not one restated for a
 * later split or dividend.
 */
export async function getCloseOn(yahooSymbol: string, isoDate: string): Promise<number | null> {
  const target = new Date(isoDate);
  const period1 = new Date(target);
  period1.setDate(period1.getDate() - 7);
  const period2 = new Date(target);
  period2.setDate(period2.getDate() + 1);

  const bars = await fetchChart(yahooSymbol, period1, period2);
  if (!bars.length) return null;

  const targetMs = target.getTime();
  const onOrBefore = bars.filter((b) => b.date.getTime() <= targetMs);
  const last = onOrBefore.length ? onOrBefore[onOrBefore.length - 1] : bars[0];
  return typeof last.close === "number" ? last.close : null;
}

interface ChartBar extends Bar {
  date: Date;
  close: number | null;
}

async function fetchChart(yahooSymbol: string, period1: Date, period2: Date): Promise<ChartBar[]> {
  try {
    // deno-lint-ignore no-explicit-any
    const result: any = await yf.chart(
      yahooSymbol,
      { period1, period2, interval: "1d" },
      NO_VALIDATE,
    );
    // deno-lint-ignore no-explicit-any
    const quotes = (result?.quotes ?? []) as any[];
    // An empty `quotes` from the library is indistinguishable here from a
    // symbol Yahoo doesn't know, and the direct fetch below tells the two
    // apart — so fall through to it rather than reporting "no history".
    if (!quotes.length) return fetchChartDirect(yahooSymbol, period1, period2);
    return quotes.map((q) => bar(q.date, q.open, q.high, q.low, q.close, q.adjclose, q.volume));
  } catch {
    // `&` in a symbol (e.g. "M&M.NS") is interpolated unencoded into the
    // chart endpoint's path by the library and can truncate the request.
    // Fall back to a direct, properly-encoded fetch of the same endpoint.
    return fetchChartDirect(yahooSymbol, period1, period2);
  }
}

/** One bar in both shapes at once — `date` for the local readers, `t` for the wire. */
function bar(
  date: Date,
  o: unknown,
  h: unknown,
  l: unknown,
  c: unknown,
  ac: unknown,
  v: unknown,
): ChartBar {
  const close = num(c);
  return {
    date,
    close,
    t: date.getTime(),
    o: num(o),
    h: num(h),
    l: num(l),
    c: close,
    // Yahoo omits `adjclose` on some symbols (indices, most notably). The raw
    // close is the honest fallback: an index has no splits to adjust for.
    ac: num(ac) ?? close,
    v: num(v),
  };
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchChartDirect(
  yahooSymbol: string,
  period1: Date,
  period2: Date,
): Promise<ChartBar[]> {
  const params = new URLSearchParams({
    period1: String(Math.floor(period1.getTime() / 1000)),
    period2: String(Math.floor(period2.getTime() / 1000)),
    interval: "1d",
    events: "div,splits",
  });
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?${params}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  type Column = Array<number | null> | undefined;
  const body = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: Column;
            high?: Column;
            low?: Column;
            close?: Column;
            volume?: Column;
          }>;
          adjclose?: Array<{ adjclose?: Column }>;
        };
      }>;
    };
  };
  const result = body.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const q = result?.indicators?.quote?.[0];
  const adj = result?.indicators?.adjclose?.[0]?.adjclose;

  return timestamps.map((ts, i) =>
    bar(
      new Date(ts * 1000),
      q?.open?.[i],
      q?.high?.[i],
      q?.low?.[i],
      q?.close?.[i],
      adj?.[i],
      q?.volume?.[i],
    ),
  );
}

// --- history ------------------------------------------------------------------

const historyCache = new Map<string, CacheEntry<Bar[]>>();
// Daily bars only change once a day, but the *last* one moves while the market
// is open, so this is short enough that an intraday reload sees a fresh close
// and long enough that a dashboard's own re-renders cost nothing.
const HISTORY_TTL_MS = 10 * 60_000;

/** Yahoo throttles hard on parallel chart calls, so the fan-out is bounded. */
const HISTORY_CONCURRENCY = 5;

/**
 * Daily OHLCV for a set of symbols over a date range.
 *
 * One chart call per symbol — Yahoo has no batch history endpoint — bounded to
 * `HISTORY_CONCURRENCY` at a time. A symbol that answers with nothing is
 * retried once on the other Indian exchange, exactly as `getQuotes` does, so a
 * basket holding a BSE-only name doesn't lose its line on the chart.
 */
export async function getHistory(
  yahooSymbols: string[],
  from: Date,
  to: Date,
): Promise<{ history: SymbolHistory[]; missing: string[] }> {
  const unique = [...new Set(yahooSymbols)].filter(Boolean);
  const history: SymbolHistory[] = [];
  const missing: string[] = [];

  const queue = [...unique];
  const workers = Array.from({ length: Math.min(HISTORY_CONCURRENCY, queue.length) }, async () => {
    for (let requested = queue.shift(); requested; requested = queue.shift()) {
      const resolved = await barsWithRetry(requested, from, to);
      if (resolved) history.push({ requested, symbol: resolved.symbol, bars: resolved.bars });
      else missing.push(requested);
    }
  });
  await Promise.all(workers);

  // The fan-out finishes out of order; the caller renders a legend from this.
  history.sort((a, b) => unique.indexOf(a.requested) - unique.indexOf(b.requested));
  return { history, missing };
}

async function barsWithRetry(
  requested: string,
  from: Date,
  to: Date,
): Promise<{ symbol: string; bars: Bar[] } | null> {
  const first = await cachedBars(requested, from, to);
  if (first.length) return { symbol: requested, bars: first };

  const other = otherExchangeSymbol(requested);
  if (!other) return null;
  const second = await cachedBars(other, from, to);
  return second.length ? { symbol: other, bars: second } : null;
}

async function cachedBars(yahooSymbol: string, from: Date, to: Date): Promise<Bar[]> {
  // The range is part of the key: a cached 1-year fetch cannot serve a 5-year
  // one, and slicing a longer cached range to a shorter one is a saving not
  // worth the bug it invites.
  const key = `${yahooSymbol}|${day(from)}|${day(to)}`;
  const hit = cacheGet(historyCache, key);
  if (hit) return hit;

  let bars: Bar[] = [];
  try {
    bars = (await fetchChart(yahooSymbol, from, to)).map(stripDate);
  } catch {
    // A single symbol failing is a gap in the dashboard, not a failed request.
    return [];
  }

  if (bars.length) cacheSet(historyCache, key, bars, HISTORY_TTL_MS);
  return bars;
}

function stripDate({ date: _date, close: _close, ...rest }: ChartBar): Bar {
  return rest;
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// --- baseline price -----------------------------------------------------------

/**
 * The price to stamp on a new basket item.
 *
 * The quote endpoint is asked first, and its failure is not the end of the
 * attempt: the chart endpoint is a different path with its own rate-limit
 * budget, so a throttled quote call costs the item a live price, not its
 * baseline. Returning null here means both endpoints were asked and neither
 * would answer — which the caller must report rather than swallow, because a
 * basket with no baseline can never show a P&L.
 */
export async function getBaselinePrice(yahooSymbol: string): Promise<BaselinePrice | null> {
  try {
    const { quotes } = await getQuotes([yahooSymbol]);
    if (quotes[0]?.price) {
      return { price: quotes[0].price, source: "live", yahooSymbol: quotes[0].symbol };
    }
  } catch {
    // Rate limited or unreachable — the chart endpoint may still answer.
  }

  try {
    const close = await getCloseOn(yahooSymbol, new Date().toISOString());
    if (close !== null) return { price: close, source: "backfill", yahooSymbol };
  } catch {
    // Fall through to null — the caller reports it.
  }

  return null;
}

// --- search ---------------------------------------------------------------

const SEARCH_EXCHANGES = new Set(["NSI", "BSE"]);
const INDIAN_SUFFIX = /\.(NS|BO)$/i;

/**
 * Yahoo's search is not deterministic: the same query can come back as a full
 * set of equities one second and as two navigation links the next. So an empty
 * result is never cached — caching one poisons the picker for the whole TTL —
 * and a query that looks like a ticker is resolved directly against the quote
 * endpoint when search comes back with nothing usable.
 */
export async function searchSymbols(query: string): Promise<SymbolMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cached = cacheGet(searchCache, q.toLowerCase());
  if (cached) return cached;

  let matches: SymbolMatch[] = [];
  try {
    // deno-lint-ignore no-explicit-any
    const result: any = await yf.search(
      q,
      { quotesCount: 20, newsCount: 0, enableNavLinks: false, enableFuzzyQuery: false },
      NO_VALIDATE,
    );
    matches = (result?.quotes ?? [])
      .filter(
        // The exchange code is the primary filter, but Yahoo sometimes omits or
        // renames it while still returning a well-formed `.NS`/`.BO` symbol.
        // deno-lint-ignore no-explicit-any
        (r: any) =>
          r.isYahooFinance &&
          r.quoteType === "EQUITY" &&
          typeof r.symbol === "string" &&
          (SEARCH_EXCHANGES.has(r.exchange) || INDIAN_SUFFIX.test(r.symbol)),
      )
      // deno-lint-ignore no-explicit-any
      .map((r: any) => {
        const { symbol, exchange } = fromYahooSymbol(r.symbol);
        return {
          symbol,
          exchange,
          name: r.longname ?? r.shortname ?? null,
          yahooSymbol: r.symbol,
        };
      });
  } catch (err) {
    if (isRateLimited(err)) throw err;
  }

  if (!matches.length) matches = await resolveAsTicker(q);
  if (matches.length) cacheSet(searchCache, q.toLowerCase(), matches, SEARCH_TTL_MS);
  return matches;
}

/**
 * Last resort for the search box: treat what was typed as a ticker and ask the
 * quote endpoint whether it exists on either Indian exchange.
 */
async function resolveAsTicker(query: string): Promise<SymbolMatch[]> {
  const symbol = query.toUpperCase().replace(INDIAN_SUFFIX, "");
  if (!/^[A-Z0-9&._-]{1,32}$/.test(symbol)) return [];

  const candidates = [
    toYahooSymbol({ symbol, exchange: "NSE" }),
    toYahooSymbol({ symbol, exchange: "BSE" }),
  ];
  const raw = await fetchQuoteBatch(candidates);

  // deno-lint-ignore no-explicit-any
  return (raw as any[]).map((r) => {
    const parsed = fromYahooSymbol(r.symbol);
    return {
      symbol: parsed.symbol,
      exchange: parsed.exchange,
      name: r.longName ?? r.shortName ?? null,
      yahooSymbol: r.symbol,
    };
  });
}
