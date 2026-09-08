/**
 * Server-side Kite Connect calls. SERVER ONLY — this module reads the API secret,
 * so it lives here and never in the web app's bundle.
 *
 * Two reasons every Kite call is proxied through the `zerodha` function rather
 * than made from the browser: the session exchange needs the secret, and
 * api.kite.trade sends no CORS headers, so a direct fetch from the page would
 * fail anyway.
 */

import type { KiteHolding, KiteMfHolding, KiteSession } from "../../../packages/shared/src/kite.ts";

const KITE_API = "https://api.kite.trade";
const KITE_LOGIN = "https://kite.zerodha.com/connect/login";

export interface KiteCredentials {
  apiKey: string;
  apiSecret: string;
}

/**
 * Credentials come from the environment and stay there. Returns null rather than
 * throwing so a route can answer with a readable "not configured" instead of a
 * 500 — this is the state the app ships in.
 *
 * There are two possible pairs, because a Kite app has exactly one registered
 * redirect URL and a developer needs the login to come back to localhost while
 * production needs it to come back to the deployed site. So a second Kite app
 * covers development, and which pair applies is decided by the origin the call
 * came from — not by a build flag, because one deployed function serves both.
 *
 * The dev pair is optional. With `KITE_API_KEY_DEV` unset, every origin gets the
 * main pair and the behaviour is exactly what it was before this existed.
 */
export function getCredentials(origin?: string | null): KiteCredentials | null {
  if (isDevOrigin(origin)) {
    const dev = pair("KITE_API_KEY_DEV", "KITE_API_SECRET_DEV");
    if (dev) return dev;
  }
  return pair("KITE_API_KEY", "KITE_API_SECRET");
}

function pair(keyVar: string, secretVar: string): KiteCredentials | null {
  const apiKey = Deno.env.get(keyVar);
  const apiSecret = Deno.env.get(secretVar);
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

/**
 * A developer's browser, by hostname rather than by an allowlist to maintain.
 * Getting this wrong is not a security question — both Kite apps belong to the
 * same person, and the secret never leaves this function either way — it just
 * decides which app's login the user is sent to.
 */
function isDevOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

export function loginUrl(apiKey: string): string {
  return `${KITE_LOGIN}?v=3&api_key=${encodeURIComponent(apiKey)}`;
}

/** Kite's error envelope: `{ status: "error", message, error_type }`. */
async function kiteFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${KITE_API}${path}`, {
    ...init,
    headers: { "X-Kite-Version": "3", ...init.headers },
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as
    | { status?: string; data?: T; message?: string }
    | null;

  if (!res.ok || body?.status !== "success") {
    throw new Error(body?.message ?? `Kite request failed (${res.status})`);
  }
  return body.data as T;
}

/**
 * Trade the one-time request token from the redirect for a session. The checksum
 * is what proves we hold the secret: SHA-256 of api_key + request_token + secret.
 */
export async function exchangeRequestToken(
  requestToken: string,
  { apiKey, apiSecret }: KiteCredentials,
): Promise<KiteSession> {
  const checksum = await sha256Hex(apiKey + requestToken + apiSecret);

  const data = await kiteFetch<KiteSession & Record<string, unknown>>("/session/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      api_key: apiKey,
      request_token: requestToken,
      checksum,
    }),
  });

  // Only the fields the app stores — the rest of Kite's session payload includes
  // things (a refresh token, exchange entitlements) we have no use for locally.
  return {
    user_id: data.user_id,
    user_name: data.user_name ?? null,
    email: data.email ?? null,
    broker: data.broker ?? null,
    access_token: data.access_token,
  };
}

export async function fetchHoldings(
  accessToken: string,
  apiKey: string,
): Promise<KiteHolding[]> {
  return kiteFetch<KiteHolding[]>("/portfolio/holdings", {
    method: "GET",
    headers: { Authorization: `token ${apiKey}:${accessToken}` },
  });
}

/**
 * Mutual funds live on their own endpoint with their own shape — a fund is a
 * folio and a NAV, not a position with a last traded price.
 */
export async function fetchMfHoldings(
  accessToken: string,
  apiKey: string,
): Promise<KiteMfHolding[]> {
  return kiteFetch<KiteMfHolding[]>("/mf/holdings", {
    method: "GET",
    headers: { Authorization: `token ${apiKey}:${accessToken}` },
  });
}

/** Web Crypto rather than `node:crypto`, so this runs unchanged on Deno. */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
