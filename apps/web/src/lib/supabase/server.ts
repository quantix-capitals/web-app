/**
 * Server-side Supabase client, for Server Components, Server Actions and Route
 * Handlers.
 *
 * The service-role key must never appear here — it bypasses RLS. Anything
 * that genuinely needs it (backfills, the agent's writes) belongs in
 * `apps/agent`.
 */

import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./client";

/** Named to avoid shadowing the `@supabase/ssr` import of the same name. */
export async function createServerSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  const cookieStore = await cookies();

  return createSupabaseServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component that can't write cookies — the
          // middleware is what refreshes the session on the next request.
        }
      },
    },
  });
}

/**
 * The signed-in user, or null. Every page that reads data starts here.
 *
 * Deliberately `getUser()`, not `getSession()` — `getSession` trusts the
 * cookie without contacting the auth server, and every Server Component here
 * gates real data on this call.
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
