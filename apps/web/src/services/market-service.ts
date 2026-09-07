/**
 * Prices, searches and historical closes — all served by the `market` edge
 * function, because Yahoo sends no CORS headers of its own.
 *
 * The live quote *stream* is not here: it lives in `lib/market/quote-store`,
 * which polls the union of every symbol on screen so several baskets sharing a
 * ticker cost one request. This module is the one-shot calls around it.
 */

import type { BaselinePrice, Quote, SymbolMatch } from "@stealth/shared";
import { get } from "./functions";

export interface QuotesResult {
  quotes: Quote[];
  missing: string[];
  asOf: string;
}

export function fetchQuotes(yahooSymbols: string[], signal?: AbortSignal) {
  return get<QuotesResult>("market", { op: "quotes", symbols: yahooSymbols.join(",") }, signal);
}

export async function searchSymbols(query: string, signal?: AbortSignal): Promise<SymbolMatch[]> {
  const { matches } = await get<{ matches: SymbolMatch[] }>(
    "market",
    { op: "search", q: query },
    signal,
  );
  return matches;
}

/** The daily close on or before a date. Null when Yahoo published none. */
export async function fetchCloseOn(yahooSymbol: string, isoDate: string): Promise<number | null> {
  const { close } = await get<{ close: number | null }>("market", {
    op: "close",
    symbol: yahooSymbol,
    on: isoDate,
  });
  return close;
}

/** The entry baseline for a symbol added today: a live quote, else today's close. */
export async function fetchBaseline(yahooSymbol: string): Promise<BaselinePrice | null> {
  const { baseline } = await get<{ baseline: BaselinePrice | null }>("market", {
    op: "baseline",
    symbol: yahooSymbol,
  });
  return baseline;
}
