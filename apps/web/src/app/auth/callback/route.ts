/**
 * Where the magic link lands. `@supabase/ssr` uses PKCE, so the link arrives
 * as `?code=` rather than a token in the hash — this exchanges it for a
 * session cookie and redirects on.
 */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/watchlist";
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      absoluteUrl(request, `/profile?auth_error=${encodeURIComponent(errorDescription)}`),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      absoluteUrl(request, "/profile?auth_error=Missing sign-in code."),
    );
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      absoluteUrl(request, `/profile?auth_error=${encodeURIComponent(error.message)}`),
    );
  }

  return NextResponse.redirect(absoluteUrl(request, next));
}

/**
 * Builds the redirect against the host the request actually arrived on —
 * behind a proxy that's `x-forwarded-host`, not the origin Next.js sees.
 */
function absoluteUrl(request: Request, path: string): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = forwardedHost ?? url.host;
  return `${forwardedProto}://${host}${path}`;
}
