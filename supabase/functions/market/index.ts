/**
 * `market` — quotes, search, historical closes and entry baselines.
 *
 * Nothing here is secret. It exists because `yahoo-finance2` talks to an
 * unofficial upstream that sets cookies and sends no CORS headers, so the
 * browser cannot make these calls itself. It still requires a signed-in user:
 * an unauthenticated proxy to Yahoo is an open proxy, and the only pages that
 * need prices are behind sign-in anyway.
 *
 * One function with an `?op=` rather than four deployments — these four calls
 * share a client, a cache and an error vocabulary, and splitting them would
 * mean four cold starts warming four copies of Yahoo's crumb.
 */

import {
  HttpError,
  corsHeadersFor,
  json,
  requireUser,
  toResponse,
  upstreamError,
} from "../_shared/http.ts";
import {
  getBaselinePrice,
  getCloseOn,
  getHistory,
  getQuotes,
  searchSymbols,
} from "../_shared/yahoo.ts";

const MAX_SYMBOLS = 100;

/**
 * History is one upstream call per symbol, unlike quotes — so it gets a tighter
 * cap than `MAX_SYMBOLS`. A basket past this is past what a dashboard can plot
 * legibly anyway.
 */
const MAX_HISTORY_SYMBOLS = 40;

Deno.serve(async (request) => {
  const cors = corsHeadersFor(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    await requireUser(request);

    const url = new URL(request.url);
    const op = url.searchParams.get("op");

    switch (op) {
      case "quotes":
        return json(await quotes(url), 200, cors);
      case "search":
        return json(await search(url), 200, cors);
      case "close":
        return json(await close(url), 200, cors);
      case "baseline":
        return json(await baseline(url), 200, cors);
      case "history":
        return json(await history(url), 200, cors);
      default:
        throw new HttpError(
          "Unknown ?op= — expected quotes, search, close, baseline or history.",
          400,
        );
    }
  } catch (error) {
    return toResponse(error, cors);
  }
});

/** `?op=quotes&symbols=RELIANCE.NS,TCS.NS` */
async function quotes(url: URL) {
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!symbols.length) throw new HttpError("Missing symbols.", 400);
  if (symbols.length > MAX_SYMBOLS) {
    throw new HttpError(`Too many symbols (max ${MAX_SYMBOLS}).`, 400);
  }

  try {
    const { quotes, missing } = await getQuotes(symbols);
    return { quotes, missing, asOf: new Date().toISOString() };
  } catch (err) {
    throw upstreamError(err, "Could not reach Yahoo Finance.");
  }
}

/**
 * `?op=search&q=` — for the add-symbol box. A short query is an empty list with
 * a 200, not an error, so the box doesn't flash red while the user is typing.
 */
async function search(url: URL) {
  const q = url.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return { matches: [] };

  try {
    return { matches: await searchSymbols(q) };
  } catch (err) {
    throw upstreamError(err, "Could not reach Yahoo Finance.");
  }
}

/**
 * `?op=close&symbol=RELIANCE.NS&on=YYYY-MM-DD` — the daily close on or before a
 * date, for a backdated entry and for the manual "set entry" repair path.
 */
async function close(url: URL) {
  const symbol = url.searchParams.get("symbol");
  const on = url.searchParams.get("on");

  if (!symbol) throw new HttpError("Missing symbol.", 400);
  if (!on || Number.isNaN(new Date(on).getTime())) {
    throw new HttpError("Missing or invalid ?on= date.", 400);
  }

  try {
    return { close: await getCloseOn(symbol, on) };
  } catch (err) {
    throw upstreamError(err, "Could not reach Yahoo Finance.");
  }
}

/**
 * `?op=baseline&symbol=RELIANCE.NS` — the entry baseline for a symbol added
 * today: a live quote, falling back to today's close.
 *
 * A null baseline is a 200, not an error. The row is still worth inserting —
 * the UI offers "Set entry" to fill it in later — so failing the whole add
 * because Yahoo was throttling would be the wrong trade.
 */
async function baseline(url: URL) {
  const symbol = url.searchParams.get("symbol");
  if (!symbol) throw new HttpError("Missing symbol.", 400);

  try {
    return { baseline: await getBaselinePrice(symbol) };
  } catch (err) {
    throw upstreamError(err, "Could not reach Yahoo Finance.");
  }
}

/**
 * `?op=history&symbols=RELIANCE.NS,^NSEI&from=YYYY-MM-DD&to=YYYY-MM-DD` — daily
 * OHLCV, for the basket dashboard.
 *
 * The benchmark rides in the same `symbols` list rather than getting a
 * parameter of its own: it is one more chart call, it wants the same range, and
 * keeping it here means the caller can swap `^NSEI` for another index without a
 * change on this side.
 *
 * A symbol that returns nothing lands in `missing` with a 200, for the same
 * reason `baseline` does — one dead ticker should cost the dashboard a line,
 * not the whole page.
 */
async function history(url: URL) {
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!symbols.length) throw new HttpError("Missing symbols.", 400);
  if (symbols.length > MAX_HISTORY_SYMBOLS) {
    throw new HttpError(`Too many symbols (max ${MAX_HISTORY_SYMBOLS}).`, 400);
  }

  const from = parseDay(url.searchParams.get("from"), "from");
  const to = url.searchParams.get("to") ? parseDay(url.searchParams.get("to"), "to") : new Date();
  if (from >= to) throw new HttpError("?from= must be before ?to=.", 400);

  try {
    const { history, missing } = await getHistory(symbols, from, to);
    return { history, missing, asOf: new Date().toISOString() };
  } catch (err) {
    throw upstreamError(err, "Could not reach Yahoo Finance.");
  }
}

function parseDay(value: string | null, name: string): Date {
  const parsed = value ? new Date(value) : new Date(NaN);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(`Missing or invalid ?${name}= date.`, 400);
  }
  return parsed;
}
