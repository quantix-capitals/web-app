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
  getQuotes,
  searchSymbols,
} from "../_shared/yahoo.ts";

const MAX_SYMBOLS = 100;

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
      default:
        throw new HttpError(
          "Unknown ?op= — expected quotes, search, close or baseline.",
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
