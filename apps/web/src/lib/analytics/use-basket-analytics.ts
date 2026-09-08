/**
 * The dashboard's data hook: one history fetch per basket, cached by React
 * Query, with the maths recomputed locally whenever the range changes.
 *
 * The split matters. Daily bars are a slow, rate-limited fetch and never change
 * for a past date, so they are fetched once for the *whole* life of the basket
 * and kept for an hour. Choosing "3M" then re-slices what is already in memory
 * — it never goes back to Yahoo, and switching ranges is instant.
 *
 * The bars are only half the picture. The last point of every line is the live
 * quote — read from the same shared store the ledger reads — so "Value now"
 * here and "Total value" there are the same number by construction rather than
 * by coincidence. The benchmark is retained alongside the holdings so the index
 * is marked at the same instant the basket is.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toYahooSymbol } from "@stealth/shared";
import type { Bar } from "@stealth/shared";
import type { WatchlistItemView } from "@/lib/watchlist/types";
import { useQuotes } from "@/lib/market/use-quotes";
import { fetchHistory } from "@/services/market-service";
import {
  BENCHMARK_SYMBOL,
  analyse,
  availableRanges,
  buildSeries,
  rangeStart,
  type BasketAnalytics,
  type RangeId,
} from "./basket";

/**
 * Days of history fetched before the earliest entry.
 *
 * Yahoo returns nothing at all for a range that lands entirely on a weekend or
 * a holiday, and a basket struck on a Saturday would otherwise have no bar to
 * baseline its growth factors against.
 */
const LEAD_DAYS = 12;

export const historyKey = (basketId: string) => ["baskets", basketId, "history"] as const;

export interface BasketAnalyticsResult {
  analytics: BasketAnalytics | null;
  isPending: boolean;
  isError: boolean;
  error: string | null;
  /** When the marks the page is showing were taken — the live poll, not the bars. */
  asOf: string | null;
  /** Symbols Yahoo had no bars for at all. */
  missing: string[];
  /** The ranges the loaded history can honour. Always contains "all". */
  ranges: RangeId[];
  /** The range actually analysed — the one asked for, or "all" if it can't be honoured. */
  range: RangeId;
  refetch: () => void;
}

export function useBasketAnalytics(
  basketId: string,
  items: WatchlistItemView[],
  range: RangeId,
): BasketAnalyticsResult {
  const symbols = useMemo(
    () =>
      [
        ...new Set(
          items
            .filter((i) => i.symbol)
            .map((i) => toYahooSymbol({ symbol: i.symbol, exchange: i.exchange })),
        ),
      ].sort(),
    [items],
  );

  const from = useMemo(() => {
    const stamps = items.map((i) => new Date(i.entryAt ?? i.addedAt).getTime()).filter(Number.isFinite);
    if (!stamps.length) return null;
    const start = new Date(Math.min(...stamps));
    start.setDate(start.getDate() - LEAD_DAYS);
    return start.toISOString().slice(0, 10);
  }, [items]);

  const to = useMemo(() => {
    // Tomorrow, not today: Yahoo's `period2` is exclusive, and asking for today
    // as the end costs the basket its most recent close.
    const end = new Date();
    end.setDate(end.getDate() + 1);
    return end.toISOString().slice(0, 10);
  }, []);

  const query = useQuery({
    // `from` and the symbol set are in the key so adding a symbol or
    // re-baselining an entry refetches rather than reusing stale bars.
    queryKey: [...historyKey(basketId), { symbols, from }],
    queryFn: ({ signal }) => fetchHistory([...symbols, BENCHMARK_SYMBOL], from!, to, signal),
    enabled: Boolean(symbols.length && from),
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    retry: 1,
  });

  // The benchmark rides along with the holdings so the index is marked at the
  // same instant they are; the store is refcounted, so sharing it with the
  // ledger's own retention costs one poll, not two.
  const quoteSymbols = useMemo(() => [...symbols, BENCHMARK_SYMBOL], [symbols]);
  const live = useQuotes(quoteSymbols);

  const series = useMemo(() => {
    if (!query.data) return null;
    const benchmark: Bar[] | null =
      query.data.history.find((h) => h.requested === BENCHMARK_SYMBOL)?.bars ?? null;
    const holdings = query.data.history.filter((h) => h.requested !== BENCHMARK_SYMBOL);
    return buildSeries(items, holdings, benchmark, live.quotes);
  }, [query.data, items, live.quotes]);

  const ranges = useMemo<RangeId[]>(
    () => (series ? availableRanges(series.dates) : ["all"]),
    [series],
  );

  // Clamped rather than merely ignored: a range the history cannot honour would
  // otherwise leave the strip highlighting "1M" over the whole series.
  const effective: RangeId = ranges.includes(range) ? range : "all";

  const analytics = useMemo(() => {
    if (!series) return null;
    return analyse(series, rangeStart(series.dates, effective));
  }, [series, effective]);

  return {
    analytics,
    isPending: query.isPending && Boolean(symbols.length && from),
    isError: query.isError,
    error: query.error instanceof Error ? query.error.message : null,
    // The quote poll, not the history fetch: the last point of every line comes
    // from it, so it is the timestamp that describes what is on screen.
    asOf: live.asOf ?? query.data?.asOf ?? null,
    missing: query.data?.missing.filter((s) => s !== BENCHMARK_SYMBOL) ?? [],
    ranges,
    range: effective,
    refetch: () => {
      void query.refetch();
      live.refresh();
    },
  };
}
