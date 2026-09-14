/**
 * Mutual-fund reference data and NAV history, from mfapi.in.
 *
 * Called straight from the page: mfapi.in serves `Access-Control-Allow-Origin: *`
 * and needs no key, so there is nothing for an edge function to hide. Three calls:
 *
 * - `GET /mf` — every scheme with its ISINs (~470 KB gzipped). Fetched once per
 *   session, and only when a book actually holds a fund, to turn Kite's ISINs
 *   into mfapi scheme codes.
 * - `GET /mf/{code}/latest` — a scheme's AMFI category, which decides whether it
 *   is an equity fund.
 * - `GET /mf/{code}?startDate&endDate` — daily NAVs, shaped as the same `Bar`s
 *   Yahoo history arrives in, so the dashboard and the analyst read them unchanged.
 */

import type { Bar, HistoryResult, SymbolHistory } from "@stealth/shared";

const BASE = "https://api.mfapi.in/mf";

/** Parallel requests to mfapi at once. It is a free service; do not hammer it. */
const CONCURRENCY = 4;

export interface FundScheme {
  isin: string;
  schemeCode: number;
  name: string;
  /** AMFI's category, e.g. "Equity Scheme - Flexi Cap Fund". */
  category: string | null;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`mfapi.in answered ${response.status}.`);
  return (await response.json()) as T;
}

let index: Promise<Map<string, number>> | null = null;

/** ISIN → scheme code, for every scheme mfapi knows. Cached for the session. */
function schemeIndex(): Promise<Map<string, number>> {
  index ??= getJson<
    Array<{ schemeCode: number; isinGrowth: string | null; isinDivReinvestment: string | null }>
  >(BASE)
    .then((rows) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        if (row.isinGrowth) map.set(row.isinGrowth.toUpperCase(), row.schemeCode);
        if (row.isinDivReinvestment) map.set(row.isinDivReinvestment.toUpperCase(), row.schemeCode);
      }
      return map;
    })
    .catch((cause: unknown) => {
      // Forget a failed load so the next attempt retries rather than re-throws.
      index = null;
      throw cause;
    });
  return index;
}

/** Runs `task` over `items`, `CONCURRENCY` at a time, preserving order. */
async function pool<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await task(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * The scheme behind each ISIN, with its category. ISINs mfapi does not list are
 * simply absent from the result.
 */
export async function fundSchemes(isins: string[]): Promise<Map<string, FundScheme>> {
  const unique = [...new Set(isins.map((i) => i.toUpperCase()))];
  const result = new Map<string, FundScheme>();
  if (!unique.length) return result;

  const codes = await schemeIndex();
  const known = unique.filter((isin) => codes.has(isin));

  await pool(known, async (isin) => {
    const schemeCode = codes.get(isin)!;
    try {
      const body = await getJson<{ meta?: { scheme_name?: string; scheme_category?: string } }>(
        `${BASE}/${schemeCode}/latest`,
      );
      result.set(isin, {
        isin,
        schemeCode,
        name: body.meta?.scheme_name ?? isin,
        category: body.meta?.scheme_category ?? null,
      });
    } catch {
      result.set(isin, { isin, schemeCode, name: isin, category: null });
    }
  });

  return result;
}

/** `"11-09-2026"` → epoch ms at the NSE open that day, the way Yahoo stamps a bar. */
function navDay(date: string): number | null {
  const [d, m, y] = date.split("-").map(Number);
  if (!d || !m || !y) return null;
  return Date.UTC(y, m - 1, d, 3, 45);
}

/**
 * Daily NAVs for a set of fund ISINs, as `SymbolHistory` keyed by the ISIN.
 *
 * A NAV has no open, high, low or volume, so those are null; the close and the
 * adjusted close are both the NAV, because a growth plan reinvests its
 * distributions into the NAV itself.
 */
export async function fetchFundHistory(
  isins: string[],
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<HistoryResult> {
  const unique = [...new Set(isins.map((i) => i.toUpperCase()))];
  const asOf = new Date().toISOString();
  if (!unique.length) return { history: [], missing: [], asOf };

  const codes = await schemeIndex();
  const history: SymbolHistory[] = [];
  const missing: string[] = [];

  await pool(unique, async (isin) => {
    const code = codes.get(isin);
    if (!code) {
      missing.push(isin);
      return;
    }
    try {
      const body = await getJson<{ data?: Array<{ date: string; nav: string }> }>(
        `${BASE}/${code}?startDate=${from}&endDate=${to}`,
        signal,
      );
      const bars: Bar[] = [];
      for (const row of body.data ?? []) {
        const t = navDay(row.date);
        const nav = Number.parseFloat(row.nav);
        if (t === null || !(nav > 0)) continue;
        bars.push({ t, o: null, h: null, l: null, c: nav, ac: nav, v: null });
      }
      bars.sort((a, b) => a.t - b.t);
      if (bars.length) history.push({ requested: isin, symbol: isin, bars });
      else missing.push(isin);
    } catch (cause) {
      if (signal?.aborted) throw cause;
      missing.push(isin);
    }
  });

  history.sort((a, b) => unique.indexOf(a.requested) - unique.indexOf(b.requested));
  return { history, missing, asOf };
}
