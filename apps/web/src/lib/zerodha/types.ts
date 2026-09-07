/**
 * The slice of Kite Connect this app reads. Field names are Kite's, verbatim —
 * renaming them here would mean two vocabularies for the same row and a mapping
 * layer to keep in sync. See https://kite.trade/docs/connect/v3/portfolio/.
 */

/** What `POST /session/token` hands back once the request token is exchanged. */
export interface KiteSession {
  user_id: string;
  user_name: string | null;
  email: string | null;
  broker: string | null;
  access_token: string;
}

/** One row of `GET /portfolio/holdings`. */
export interface KiteHolding {
  tradingsymbol: string;
  exchange: string;
  isin: string | null;
  product: string;
  quantity: number;
  /** Bought today, not yet settled into `quantity`. Still yours; still counts. */
  t1_quantity: number;
  average_price: number;
  last_price: number;
  close_price: number;
  pnl: number;
  day_change: number;
  day_change_percentage: number;
}

/**
 * One row of `GET /mf/holdings`. Deliberately not merged with `KiteHolding`:
 * a fund has no intraday mark, so there is no day change to show, and its
 * "price" is a NAV struck once a day. Forcing both into one type would mean a
 * column that is always blank on one of them.
 */
export interface KiteMfHolding {
  folio: string | null;
  fund: string;
  tradingsymbol: string;
  quantity: number;
  average_price: number;
  last_price: number;
  /** The date the NAV was struck — a fund's price is always stale by design. */
  last_price_date: string | null;
  pnl: number;
}

/**
 * Everything the browser keeps about a Zerodha connection. Local-only for now —
 * this whole object lives in localStorage, nothing reaches Supabase. The access
 * token is a session credential that Zerodha expires every morning, so the worst
 * a stale copy can do is fail the next fetch.
 */
export interface ZerodhaConnection {
  session: KiteSession;
  holdings: KiteHolding[];
  mf_holdings: KiteMfHolding[];
  /** When holdings were last pulled, ISO. Null until the first successful fetch. */
  synced_at: string | null;
  connected_at: string;
}

/**
 * Position totals, derived rather than stored so they can never drift.
 *
 * `dayChange` is null for anything with no intraday mark — a mutual fund is
 * priced once a day, so a zero there would read as "flat today" when the truth
 * is "not a question this asset can answer".
 */
export interface HoldingsSummary {
  marketValue: number;
  invested: number;
  unrealised: number;
  dayChange: number | null;
  count: number;
}

export function summarise(holdings: KiteHolding[]): HoldingsSummary {
  let marketValue = 0;
  let invested = 0;
  let dayChange = 0;

  for (const h of holdings) {
    const qty = h.quantity + h.t1_quantity;
    marketValue += qty * h.last_price;
    invested += qty * h.average_price;
    dayChange += qty * h.day_change;
  }

  return {
    marketValue,
    invested,
    unrealised: marketValue - invested,
    dayChange,
    count: holdings.length,
  };
}

export function summariseMf(holdings: KiteMfHolding[]): HoldingsSummary {
  let marketValue = 0;
  let invested = 0;

  for (const h of holdings) {
    marketValue += h.quantity * h.last_price;
    invested += h.quantity * h.average_price;
  }

  return {
    marketValue,
    invested,
    unrealised: marketValue - invested,
    dayChange: null, // A fund has no intraday mark. See HoldingsSummary.
    count: holdings.length,
  };
}
