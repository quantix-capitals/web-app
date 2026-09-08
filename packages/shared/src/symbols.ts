/** Pure symbol/exchange plumbing shared by the market layer and the UI. */

export interface ExchangeSymbol {
  symbol: string;
  exchange: string;
}

const SUFFIX: Record<string, string> = { NSE: ".NS", BSE: ".BO" };
const FROM_SUFFIX: Record<string, string> = { ".NS": "NSE", ".BO": "BSE" };

/** `{symbol: "RELIANCE", exchange: "NSE"}` → `"RELIANCE.NS"`. */
export function toYahooSymbol({ symbol, exchange }: ExchangeSymbol): string {
  const suffix = SUFFIX[exchange.toUpperCase()] ?? "";
  return `${symbol.toUpperCase()}${suffix}`;
}

/** `"RELIANCE.NS"` → `{symbol: "RELIANCE", exchange: "NSE"}`. */
export function fromYahooSymbol(yahooSymbol: string): ExchangeSymbol {
  for (const [suffix, exchange] of Object.entries(FROM_SUFFIX)) {
    if (yahooSymbol.endsWith(suffix)) {
      return { symbol: yahooSymbol.slice(0, -suffix.length), exchange };
    }
  }
  return { symbol: yahooSymbol, exchange: "NSE" };
}

/** The React key used everywhere an instrument is rendered: `"NSE:RELIANCE"`. */
export function instrumentKey({ symbol, exchange }: ExchangeSymbol): string {
  return `${exchange.toUpperCase()}:${symbol.toUpperCase()}`;
}

/**
 * Where a ticker goes when you click it. Google Finance quotes are addressed
 * `SYMBOL:EXCHANGE` — the same two facts we already carry everywhere — so no
 * per-instrument mapping table is needed.
 */
export function googleFinanceUrl({ symbol, exchange }: ExchangeSymbol): string {
  return `https://www.google.com/finance/beta/quote/${encodeURIComponent(
    symbol.toUpperCase(),
  )}:${encodeURIComponent(exchange.toUpperCase())}`;
}
