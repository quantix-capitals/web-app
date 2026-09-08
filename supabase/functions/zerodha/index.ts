/**
 * `zerodha` — the Kite Connect hand-off and the holdings proxy.
 *
 * This one genuinely cannot move to the browser: `KITE_API_SECRET` signs the
 * session checksum, and a secret in a page is not a secret. api.kite.trade also
 * sends no CORS headers, so even the calls that need no secret have to come
 * from here.
 *
 * Nothing is persisted. The browser holds the access token (see the web app's
 * `lib/zerodha/local-store`) and sends it up per call; this adds the API key and
 * forwards. That is a deliberate "for now": no session table, and a connection
 * that lives in exactly one browser.
 */

import {
  HttpError,
  corsHeadersFor,
  json,
  requireUser,
  toResponse,
} from "../_shared/http.ts";
import {
  exchangeRequestToken,
  fetchHoldings,
  fetchMfHoldings,
  getCredentials,
  loginUrl,
} from "../_shared/kite.ts";

const NOT_CONFIGURED = "Zerodha is not configured. Set KITE_API_KEY and KITE_API_SECRET.";

/** Where to bounce the user back to. The web app's origin. */
function webOrigin(): string {
  return (Deno.env.get("WEB_ORIGIN") ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Which site is calling, and therefore which Kite app to use.
 *
 * `session` and `holdings` are cross-origin fetches, so the browser attaches an
 * `Origin` header itself and it cannot be forgotten. `login` is a top-level
 * navigation, which sends no such header, so the page passes `?origin=` instead
 * — that is the one place this has to be spelled out by the caller.
 */
function callerOrigin(request: Request, url: URL): string | null {
  return request.headers.get("origin") ?? url.searchParams.get("origin");
}

Deno.serve(async (request) => {
  const cors = corsHeadersFor(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(request.url);
  const op = url.searchParams.get("op");

  const origin = callerOrigin(request, url);

  // `login` is a top-level browser navigation, not a fetch — there is no way to
  // attach a bearer token to it, and there is nothing to protect: it reveals
  // only the API key, which Kite shows to the user on the next screen anyway.
  if (op === "login") return login(origin);

  try {
    await requireUser(request);

    switch (op) {
      case "session":
        return json(await session(request, origin), 200, cors);
      case "holdings":
        return json(await holdings(request, origin), 200, cors);
      default:
        throw new HttpError("Unknown ?op= — expected login, session or holdings.", 400);
    }
  } catch (error) {
    return toResponse(error, cors);
  }
});

/**
 * Step one: bounce the user to Zerodha's login. A redirect rather than a link in
 * the page, so the API key never has to be a client-visible variable. Zerodha
 * sends the user back to the redirect URL registered on the Kite app — point
 * that at `{WEB_ORIGIN}/zerodha/callback`.
 */
function login(origin: string | null): Response {
  const creds = getCredentials(origin);
  const target = creds
    ? loginUrl(creds.apiKey)
    : // Back to where they clicked, with something the UI can explain.
      `${origin ?? webOrigin()}/portfolio?zerodha=not-configured`;
  return Response.redirect(target, 302);
}

/** Step two: trade the one-time request token for an access token. */
async function session(request: Request, origin: string | null) {
  const creds = getCredentials(origin);
  if (!creds) throw new HttpError(NOT_CONFIGURED, 501);

  const requestToken = await field(request, "request_token");

  try {
    return await exchangeRequestToken(requestToken, creds);
  } catch (err) {
    // A request token is single-use and short-lived, so this is usually a stale
    // or replayed redirect rather than anything a retry would fix.
    throw new HttpError(
      err instanceof Error ? err.message : "Token exchange failed.",
      502,
    );
  }
}

/** Holdings, proxied. */
async function holdings(request: Request, origin: string | null) {
  const creds = getCredentials(origin);
  if (!creds) throw new HttpError(NOT_CONFIGURED, 501);

  const accessToken = await field(request, "access_token");

  try {
    // Equity decides the request. Mutual funds are a separate Kite endpoint that
    // some accounts simply cannot reach, so a failure there must not blank out a
    // book that loaded fine — it comes back as an empty list plus a note.
    const [equity, mf] = await Promise.all([
      fetchHoldings(accessToken, creds.apiKey),
      fetchMfHoldings(accessToken, creds.apiKey).catch((e: unknown) => e as Error),
    ]);

    const mfFailed = mf instanceof Error;
    return {
      holdings: equity,
      mfHoldings: mfFailed ? [] : mf,
      mfError: mfFailed ? mf.message : null,
    };
  } catch (err) {
    // Kite expires every access token each morning, so an expired session is the
    // ordinary case here, not an exception. The UI reads 401 as "reconnect".
    const message = err instanceof Error ? err.message : "Could not reach Zerodha.";
    const expired = /token|session|authoris|authoriz/i.test(message);
    throw new HttpError(message, expired ? 401 : 502);
  }
}

/** One required string off a JSON body. */
async function field(request: Request, name: string): Promise<string> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    throw new HttpError("Expected a JSON body.", 400);
  }
  const value = body?.[name];
  if (typeof value !== "string" || !value) {
    throw new HttpError(`Missing ${name}.`, 400);
  }
  return value;
}
