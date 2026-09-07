/**
 * Browser-side Supabase client. STRUCTURE ONLY — nothing is wired yet.
 *
 * When you create the project:
 *   npm i @supabase/supabase-js @supabase/ssr -w @stealth/web
 *
 * then replace the body below with `createBrowserClient` from `@supabase/ssr`,
 * which is the one that shares a session cookie with the server client next door.
 * Only the anon key belongs in this file — it ships to the browser, and RLS (see
 * `supabase/migrations/0001_init.sql`) is what actually protects the rows.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function createClient(): never {
  throw new Error(
    "Supabase is not wired yet. Install @supabase/ssr and return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY) here.",
  );
}
