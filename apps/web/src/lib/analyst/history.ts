/**
 * Daily bars for more symbols than one request will carry.
 *
 * `?op=history` caps a call at 40 symbols (`MAX_HISTORY_SYMBOLS` in
 * `supabase/functions/market/index.ts`) — a real cap, because each symbol is a
 * separate upstream fetch and a 50-symbol call is a slow call that rate-limits
 * the next one. The analyst needs the basket's holdings *and* a bench of
 * candidates to replace them with, which together clear that cap comfortably, so
 * the work is split into batches here rather than raised there.
 *
 * Batches run in sequence, not in parallel. Firing four concurrent 40-symbol
 * fetches at Yahoo through one edge function is the reliable way to be
 * rate-limited, and this runs once an hour per basket — the extra second costs
 * nothing that anyone is waiting on.
 */

import { fetchHistory } from "@/services/market-service";
import type { HistoryResult, SymbolHistory } from "@stealth/shared";

/** Kept just under the function's own cap, so one stray symbol cannot 400 a batch. */
const BATCH = 36;

export async function fetchHistoryBatched(
  symbols: string[],
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<HistoryResult> {
  if (!symbols.length) {
    return { history: [], missing: [], asOf: new Date().toISOString() };
  }

  const history: SymbolHistory[] = [];
  const missing: string[] = [];
  let asOf = new Date().toISOString();

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const result = await fetchHistory(batch, from, to, signal);
    history.push(...result.history);
    missing.push(...result.missing);
    asOf = result.asOf;
  }

  return { history, missing, asOf };
}
