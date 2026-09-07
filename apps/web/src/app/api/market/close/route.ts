/**
 * `GET ?symbol=RELIANCE.NS&on=YYYY-MM-DD` — the daily close on or before a
 * date, for the manual "set entry" repair path.
 */

import { NextResponse } from "next/server";
import { getCloseOn } from "@/lib/market/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol");
  const on = url.searchParams.get("on");

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }
  if (!on || Number.isNaN(new Date(on).getTime())) {
    return NextResponse.json({ error: "Missing or invalid ?on= date." }, { status: 400 });
  }

  try {
    const close = await getCloseOn(symbol, on);
    return NextResponse.json({ close });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach Yahoo Finance.";
    const rateLimited = /429|rate limit|too many/i.test(message);
    return NextResponse.json({ error: message }, { status: rateLimited ? 429 : 502 });
  }
}
