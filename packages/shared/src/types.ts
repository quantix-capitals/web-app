export interface Quote {
  symbol: string;
  price: number;
  previousClose: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  currency: string | null;
  marketState: string | null;
  /** ISO timestamp of when this quote was fetched. */
  asOf: string;
}

export type QuoteMap = Record<string, Quote>;

export interface SymbolMatch {
  symbol: string;
  exchange: string;
  name: string | null;
  /** Yahoo's raw symbol, e.g. "RELIANCE.NS" — carried through to avoid re-deriving it. */
  yahooSymbol: string;
}

/** What the `market` function stamps on a new basket item as its entry price. */
export interface BaselinePrice {
  price: number;
  source: "live" | "backfill";
  /** The symbol that actually priced — may be the other exchange's. */
  yahooSymbol: string;
}
