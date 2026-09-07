/**
 * Holdings, proxied. The browser holds the access token (see
 * `lib/zerodha/local-store`) and sends it up per call; the server adds the API
 * key and forwards to Kite, which serves no CORS headers of its own.
 */

import { NextResponse } from "next/server";
import { fetchHoldings, getCredentials } from "@/lib/zerodha/kite";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const creds = getCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: "Zerodha is not configured. Set KITE_API_KEY and KITE_API_SECRET." },
      { status: 501 },
    );
  }

  let accessToken: unknown;
  try {
    ({ access_token: accessToken } = await req.json());
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (typeof accessToken !== "string" || !accessToken) {
    return NextResponse.json({ error: "Missing access_token." }, { status: 400 });
  }

  try {
    const holdings = await fetchHoldings(accessToken, creds.apiKey);
    return NextResponse.json({ holdings });
  } catch (err) {
    // Kite expires every access token each morning, so an expired session is the
    // ordinary case here, not an exception. The UI reads 401 as "reconnect".
    const message = err instanceof Error ? err.message : "Could not reach Zerodha.";
    const expired = /token|session|authoris|authoriz/i.test(message);
    return NextResponse.json({ error: message }, { status: expired ? 401 : 502 });
  }
}
