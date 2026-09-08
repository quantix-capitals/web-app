/**
 * The small amount of plumbing every function here shares: CORS, JSON replies,
 * and "who is calling".
 *
 * These functions exist for exactly two reasons — a secret that can never reach
 * the browser (Kite's API secret signs the session checksum) and upstreams that
 * send no CORS headers of their own (api.kite.trade, Yahoo). Everything else the
 * app does talks to Supabase directly from the page with the anon key, guarded
 * by RLS. If a new endpoint here doesn't have one of those two reasons, it
 * probably belongs in the page instead.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Comma-separated in `ALLOWED_ORIGINS`. Unset reflects whatever origin asked,
 * which is what local development wants; setting it is what a deploy should do.
 */
function allowedOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function corsHeadersFor(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowlist = allowedOrigins();
  const allow = !allowlist.length
    ? (origin ?? "*")
    : allowlist.includes((origin ?? "").replace(/\/$/, ""))
      ? origin
      : null;

  if (!allow) return {};
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    Vary: "Origin",
  };
}

export function json(
  body: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Thrown by the helpers below; `toResponse` turns it into the reply. */
export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function toResponse(error: unknown, cors: Record<string, string>): Response {
  if (error instanceof HttpError) return json({ error: error.message }, error.status, cors);
  console.error(error);
  return json({ error: "Something went wrong." }, 500, cors);
}

/**
 * The signed-in user, or a 401.
 *
 * Supabase's own `verify_jwt` gate is not enough on its own: the anon key is
 * itself a valid project JWT, so it passes that check while belonging to nobody.
 * This asks the auth server who the token actually is, which is the difference
 * between "a request from our app" and "a request from our user".
 */
export async function requireUser(request: Request): Promise<{ id: string }> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError("Sign in to do that.", 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError("Sign in to do that.", 401);
  return { id: data.user.id };
}

/** Yahoo throttles rather than fails; the UI backs off on a 429 but retries a 502. */
export function upstreamError(err: unknown, fallback: string): HttpError {
  const message = err instanceof Error ? err.message : fallback;
  const rateLimited = /429|rate limit|too many/i.test(message);
  return new HttpError(message, rateLimited ? 429 : 502);
}
