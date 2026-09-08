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

/**
 * One daily bar. Every field but the timestamp is nullable: Yahoo publishes
 * holidays and halted sessions as rows of nulls rather than omitting them, and
 * a bar that reads `0` where it means "no print" would quietly land in an
 * average.
 */
export interface Bar {
  /** Epoch milliseconds at the session's open, as Yahoo dates it. */
  t: number;
  o: number | null;
  h: number | null;
  l: number | null;
  c: number | null;
  /**
   * Close restated for later splits and dividends. The dashboard's return
   * series is built from this, not from `c` — a 1:5 split shows up in the raw
   * close as an 80% loss, and one split in one holding would otherwise sink
   * the whole basket's history.
   */
  ac: number | null;
  v: number | null;
}

/** A symbol's bars, as `?op=history` returns them. */
export interface SymbolHistory {
  /** The Yahoo symbol that actually answered — may be the other exchange's. */
  symbol: string;
  /** The symbol as asked for, so the caller can key by what it sent. */
  requested: string;
  bars: Bar[];
}

export interface HistoryResult {
  history: SymbolHistory[];
  missing: string[];
  asOf: string;
}

/** What the `market` function stamps on a new basket item as its entry price. */
export interface BaselinePrice {
  price: number;
  source: "live" | "backfill";
  /** The symbol that actually priced — may be the other exchange's. */
  yahooSymbol: string;
}
