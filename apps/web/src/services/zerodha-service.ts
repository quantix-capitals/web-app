/**
 * The Zerodha connect flow's two fetches, plus where to send the browser to
 * start it. Everything goes through the `zerodha` edge function — the session
 * exchange needs the API secret, and api.kite.trade refuses CORS.
 */

import type { KiteHolding, KiteMfHolding, KiteSession } from "@stealth/shared";
import { functionUrl, post } from "./functions";

/**
 * Step one is a top-level navigation, not a fetch: the function answers with a
 * redirect to Zerodha, and Zerodha will only redirect back to the URL registered
 * on the Kite app. Assign `location.href` to this.
 *
 * The origin is passed because a navigation carries no `Origin` header, and the
 * function needs it to choose between the development and production Kite apps
 * — they are two separate apps precisely because each can register only one
 * redirect URL, and this is how the login is sent to the one that will come back
 * to the site the user is actually on.
 */
export function loginUrl(): string {
  return functionUrl("zerodha", { op: "login", origin: window.location.origin });
}

/** Step two: trade the one-time request token from the redirect for a session. */
export function exchangeRequestToken(requestToken: string): Promise<KiteSession> {
  return post<KiteSession>("zerodha", "session", { request_token: requestToken });
}

export interface HoldingsResult {
  holdings: KiteHolding[];
  mfHoldings: KiteMfHolding[];
  /** Set when the mutual-fund endpoint failed but equity loaded fine. */
  mfError: string | null;
}

export function fetchHoldings(accessToken: string): Promise<HoldingsResult> {
  return post<HoldingsResult>("zerodha", "holdings", { access_token: accessToken });
}
