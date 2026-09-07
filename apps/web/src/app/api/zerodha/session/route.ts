/**
 * Step two: trade the request token for an access token.
 *
 * The session is handed straight back to the browser, which stores it in
 * localStorage — nothing is persisted server-side and nothing reaches Supabase.
 * That is a deliberate "for now": it means no session table, and it means a
 * connection lives in exactly one browser.
 */

import { NextResponse } from "next/server";
import { exchangeRequestToken, getCredentials } from "@/lib/zerodha/kite";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const creds = getCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: "Zerodha is not configured. Set KITE_API_KEY and KITE_API_SECRET." },
      { status: 501 },
    );
  }

  let requestToken: unknown;
  try {
    ({ request_token: requestToken } = await req.json());
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (typeof requestToken !== "string" || !requestToken) {
    return NextResponse.json({ error: "Missing request_token." }, { status: 400 });
  }

  try {
    const session = await exchangeRequestToken(requestToken, creds);
    return NextResponse.json(session);
  } catch (err) {
    // A request token is single-use and short-lived, so this is usually a stale
    // or replayed redirect rather than anything the user can fix by retrying.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token exchange failed." },
      { status: 502 },
    );
  }
}
