/**
 * Step one of the connect flow: bounce the user to Zerodha's login.
 *
 * This is a redirect rather than a link in the page so the API key never has to
 * be a `NEXT_PUBLIC_` variable. Zerodha sends the user back to the redirect URL
 * registered on the Kite app — point that at `/zerodha/callback`.
 */

import { NextResponse } from "next/server";
import { getCredentials, loginUrl } from "@/lib/zerodha/kite";

export const runtime = "nodejs";

export function GET(req: Request) {
  const creds = getCredentials();
  if (!creds) {
    // Back to where they clicked, with something the UI can explain.
    return NextResponse.redirect(new URL("/portfolio?zerodha=not-configured", req.url));
  }
  return NextResponse.redirect(loginUrl(creds.apiKey));
}
