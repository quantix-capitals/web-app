/**
 * `GET ?q=` — symbol search for the add-symbol box. A short query returns an
 * empty list with 200 rather than an error, so a search box doesn't flash red
 * while the user is still typing.
 */

import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/market/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ matches: [] });
  }

  try {
    const matches = await searchSymbols(q);
    return NextResponse.json({ matches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach Yahoo Finance.";
    const rateLimited = /429|rate limit|too many/i.test(message);
    return NextResponse.json({ error: message }, { status: rateLimited ? 429 : 502 });
  }
}
