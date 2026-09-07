/**
 * Basket P&L. Modelled on `lib/zerodha/types.ts`, including its nullability
 * discipline: a missing quote or a missing baseline is `null`, never `0` —
 * "this row can't answer that" is a different fact from "flat".
 */

import { toYahooSymbol } from "@stealth/shared";
import type { Quote, QuoteMap } from "@stealth/shared";
import type { WatchlistItemView } from "./types";

export interface ItemPnl {
  invested: number | null;
  marketValue: number | null;
  unrealised: number | null;
  returnPct: number | null;
  dayChange: number | null;
}

export interface ListPnl {
  invested: number | null;
  marketValue: number | null;
  unrealised: number | null;
  returnPct: number | null;
  dayChange: number | null;
  count: number;
  pricedCount: number;
}

export function itemPnl(item: WatchlistItemView, quote: Quote | undefined): ItemPnl {
  const hasBaseline = item.entryPrice !== null;
  const hasQuote = Boolean(quote);

  if (!hasBaseline) {
    return { invested: null, marketValue: null, unrealised: null, returnPct: null, dayChange: null };
  }

  const invested = item.quantity * item.entryPrice!;

  if (!hasQuote) {
    return { invested, marketValue: null, unrealised: null, returnPct: null, dayChange: null };
  }

  const marketValue = item.quantity * quote!.price;
  const unrealised = marketValue - invested;
  const returnPct = invested > 0 ? unrealised / invested : null;
  const dayChange = quote!.dayChange !== null ? item.quantity * quote!.dayChange : null;

  return { invested, marketValue, unrealised, returnPct, dayChange };
}

/**
 * The roll-up sums only items that are both based (have an entry price) and
 * priced (have a live quote). Summing INR across items *is* value-weighting
 * — never average per-item percentages, or a ten-share loser and a
 * one-share winner would cancel out as if they mattered equally.
 */
export function listPnl(items: WatchlistItemView[], quotes: QuoteMap): ListPnl {
  let invested = 0;
  let marketValue = 0;
  let dayChange = 0;
  let dayChangeKnown = true;
  let pricedCount = 0;

  for (const item of items) {
    const q = quotes[keyFor(item)];
    const pnl = itemPnl(item, q);
    if (pnl.invested === null || pnl.marketValue === null) continue;

    pricedCount += 1;
    invested += pnl.invested;
    marketValue += pnl.marketValue;

    if (pnl.dayChange === null) dayChangeKnown = false;
    else dayChange += pnl.dayChange;
  }

  if (pricedCount === 0) {
    return {
      invested: null,
      marketValue: null,
      unrealised: null,
      returnPct: null,
      dayChange: null,
      count: items.length,
      pricedCount: 0,
    };
  }

  const unrealised = marketValue - invested;
  return {
    invested,
    marketValue,
    unrealised,
    returnPct: invested > 0 ? unrealised / invested : null,
    dayChange: dayChangeKnown ? dayChange : null,
    count: items.length,
    pricedCount,
  };
}

/** The key an item is looked up by in a `QuoteMap` — its Yahoo symbol. */
export function keyFor(item: WatchlistItemView): string {
  return toYahooSymbol({ symbol: item.symbol, exchange: item.exchange });
}
