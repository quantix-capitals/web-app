/**
 * `GET ?symbols=RELIANCE.NS,TCS.NS` — quotes for a batch of Yahoo symbols.
 * GET rather than POST: nothing here is secret, unlike the Kite routes, and a
 * GET is trivially debuggable by pasting the URL in a browser.
 */

import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/market/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SYMBOLS = 100;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("symbols") ?? "";
  const symbols = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!symbols.length) {
    return NextResponse.json({ error: "Missing symbols." }, { status: 400 });
  }
  if (symbols.length > MAX_SYMBOLS) {
    return NextResponse.json(
      { error: `Too many symbols (max ${MAX_SYMBOLS}).` },
      { status: 400 },
    );
  }

  try {
    const { quotes, missing } = await getQuotes(symbols);
    return NextResponse.json({ quotes, missing, asOf: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach Yahoo Finance.";
    const rateLimited = /429|rate limit|too many/i.test(message);
    return NextResponse.json({ error: message }, { status: rateLimited ? 429 : 502 });
  }
}
