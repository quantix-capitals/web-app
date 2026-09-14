/**
 * Mutual funds, as holdings a book can contain.
 *
 * A fund is carried through the app the same way a stock is — a symbol, an
 * exchange, a quantity, a cost — so the dashboard and the analyst need no second
 * code path. The symbol is the fund's ISIN (which is what Kite's `/mf/holdings`
 * returns as `tradingsymbol`) and the exchange is `MF`. The one thing that has to
 * know the difference is where prices come from: Yahoo has no Indian NAVs, so
 * fund history is read from mfapi.in instead (`services/fund-service.ts`).
 *
 * Only **equity** funds are brought into a book. A liquid or gilt fund next to a
 * stock basket would read as a low-volatility holding dragging on returns, which
 * is a category error rather than a finding.
 */

export const FUND_EXCHANGE = "MF";

/** Indian mutual-fund ISINs all start `INF`. */
const FUND_ISIN = /^INF[0-9A-Z]{9}$/;

export function isFundSymbol(symbol: string): boolean {
  return FUND_ISIN.test(symbol.toUpperCase());
}

/**
 * Words that mark an index fund or ETF as debt even though AMFI files it under
 * "Other Scheme", alongside the equity index funds.
 */
const DEBT_NAME =
  /\b(gilt|g-?sec|sdl|bond|debt|liquid|money market|overnight|treasury|t-?bill|ibx|corporate|psu|credit|duration|floater|income|gold|silver)\b/i;

/**
 * Whether a fund belongs in an equity book.
 *
 * AMFI's category is the authority: anything filed as an equity scheme counts.
 * Index funds, ETFs and overseas fund-of-funds are filed together under "Other
 * Scheme" whatever they hold, so those are admitted only when the name does not
 * say debt or a commodity.
 */
export function isEquityFund(category: string | null, name: string): boolean {
  if (!category) return false;
  if (/^equity schemes?\b/i.test(category)) return true;
  if (/^other schemes? - (index funds|other etfs|fof overseas)/i.test(category)) {
    return !DEBT_NAME.test(name);
  }
  return false;
}

/** "Equity Scheme - Large Cap Fund" → "Large Cap Fund". */
export function fundCategoryLabel(category: string | null): string {
  if (!category) return "Fund";
  const tail = category.split(" - ").slice(1).join(" - ").trim();
  return tail || category;
}
