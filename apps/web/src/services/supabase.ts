/**
 * The Supabase client, and the only one there is.
 *
 * Only the anon key belongs in this file — it ships to the browser, and RLS
 * (see `supabase/migrations/`) is what actually protects the rows. That is also
 * why nearly every read and write in this app can happen straight from the page
 * with no server in between: the database enforces ownership, so a server that
 * only re-checked what Postgres already checks would be ceremony.
 *
 * The session lives in localStorage and refreshes itself. `detectSessionInUrl`
 * is what completes a magic-link sign-in: the link lands on `/auth/callback`
 * with a `?code=`, and the client exchanges it without a route of our own.
 */

import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/**
 * The app is designed to render without a backing project — every page shows
 * its signed-out state rather than crashing — so this is a question the UI asks,
 * not an assertion that throws at import time.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "stealth:auth",
    },
  },
);

/**
 * The bearer token for a call to one of the edge functions. Null when signed
 * out — the functions answer 401, which is what the UI wants to show anyway.
 */
export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
