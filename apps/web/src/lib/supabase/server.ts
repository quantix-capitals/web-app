/**
 * Server-side Supabase client, for Server Components and Route Handlers.
 * STRUCTURE ONLY — nothing is wired yet.
 *
 * Replace the body with `createServerClient` from `@supabase/ssr`, handing it
 * `cookies()` from `next/headers` so the user's session travels with the request
 * and RLS sees a real `auth.uid()`.
 *
 * The service-role key must never appear here — it bypasses RLS. Anything that
 * genuinely needs it (backfills, the agent's writes) belongs in `apps/agent`.
 */

export function createServerClient(): never {
  throw new Error(
    "Supabase is not wired yet. Install @supabase/ssr and return createServerClient(url, anonKey, { cookies }) here.",
  );
}

/** The signed-in user, or null. Every page that reads data starts here. */
export async function getCurrentUser(): Promise<null> {
  return null;
}
