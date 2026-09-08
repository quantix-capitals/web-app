/**
 * The page's side of the Supabase Edge Functions.
 *
 * Two functions, `market` and `zerodha`, each dispatching on `?op=`. They exist
 * only because a browser cannot hold the Kite secret and cannot fetch an
 * upstream that sends no CORS headers — everything else goes straight to
 * Postgres from `services/supabase.ts`.
 *
 * In development Vite proxies `/functions/v1` to whatever `VITE_FUNCTIONS_URL`
 * points at (`supabase functions serve`, by default), so these paths are
 * same-origin here and absolute in production.
 */

import { SUPABASE_ANON_KEY, accessToken } from "./supabase";

const BASE = (import.meta.env.VITE_FUNCTIONS_URL ?? "/functions/v1").replace(/\/$/, "");

export function functionUrl(name: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return `${BASE}/${name}${query ? `?${query}` : ""}`;
}

/** The shape every function here answers an error with. */
export class FunctionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(
  name: string,
  params: Record<string, string>,
  init?: { body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const token = await accessToken();
  const hasBody = init?.body !== undefined;
  const res = await fetch(functionUrl(name, params), {
    method: hasBody ? "POST" : "GET",
    signal: init?.signal,
    headers: {
      // `apikey` gets the request past the gateway; the bearer token is what
      // the function itself checks to learn which user is calling.
      apikey: SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });

  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new FunctionError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

export function get<T>(
  name: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  return call<T>(name, params, { signal });
}

export function post<T>(name: string, op: string, body: unknown): Promise<T> {
  return call<T>(name, { op }, { body });
}
