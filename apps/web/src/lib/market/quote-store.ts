/**
 * The shared quote cache. An external store, not component state — several
 * baskets can be on screen at once, each wanting the same handful of
 * symbols, and per-component timers would fire near-identical polls and get
 * rate-limited. Every consumer instead retains the symbols it cares about
 * and reads from one poll of the union.
 *
 * Same shape as `lib/zerodha/local-store` — `subscribe` / `getSnapshot` for
 * `useSyncExternalStore` — except this store isn't persisted; it lives only as
 * long as the tab does.
 */

import type { QuoteMap } from "@stealth/shared";
import { fetchQuotes } from "@/services/market-service";

interface Snapshot {
  quotes: QuoteMap;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  asOf: string | null;
  missing: string[];
}

const EMPTY_SNAPSHOT: Snapshot = {
  quotes: {},
  status: "idle",
  error: null,
  asOf: null,
  missing: [],
};

let listeners: Array<() => void> = [];
let snapshot: Snapshot = EMPTY_SNAPSHOT;

const refcounts = new Map<string, number>();
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: AbortController | null = null;
let backoffMs = 30_000;
const MIN_INTERVAL_MS = 30_000;
const IDLE_INTERVAL_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export function subscribe(cb: () => void): () => void {
  listeners = [...listeners, cb];
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export function getSnapshot(): Snapshot {
  return snapshot;
}

function commit(next: Partial<Snapshot>) {
  const merged = { ...snapshot, ...next };
  // Only swap the reference when something actually changed — a stable
  // reference is what keeps useSyncExternalStore from looping.
  if (shallowEqualSnapshot(snapshot, merged)) return;
  snapshot = merged;
  for (const l of listeners) l();
}

function shallowEqualSnapshot(a: Snapshot, b: Snapshot): boolean {
  return (
    a.quotes === b.quotes &&
    a.status === b.status &&
    a.error === b.error &&
    a.asOf === b.asOf &&
    a.missing === b.missing
  );
}

/** Registers interest in a set of symbols; returns the release function. */
export function retain(symbols: string[]): () => void {
  for (const s of symbols) refcounts.set(s, (refcounts.get(s) ?? 0) + 1);
  ensurePolling();
  void refresh();

  return () => {
    for (const s of symbols) {
      const next = (refcounts.get(s) ?? 1) - 1;
      if (next <= 0) refcounts.delete(s);
      else refcounts.set(s, next);
    }
  };
}

function retainedSymbols(): string[] {
  return [...refcounts.keys()];
}

function ensurePolling() {
  if (typeof document === "undefined") return;
  if (pollTimer) return;
  scheduleNext(nextIntervalMs());
  document.addEventListener("visibilitychange", onVisibilityChange);
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    void refresh();
  }
}

function nextIntervalMs(): number {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return IDLE_INTERVAL_MS;
  }
  const anyRegular = Object.values(snapshot.quotes).some((q) => q.marketState === "REGULAR");
  return anyRegular ? MIN_INTERVAL_MS : IDLE_INTERVAL_MS;
}

function scheduleNext(delayMs: number) {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    void refresh().finally(() => scheduleNext(nextIntervalMs()));
  }, delayMs);
}

export async function refresh(): Promise<void> {
  const symbols = retainedSymbols();
  if (!symbols.length) return;
  // A poll firing while one is already in flight is dropped, not queued.
  if (inFlight) return;

  const controller = new AbortController();
  inFlight = controller;
  commit({ status: snapshot.status === "ready" ? "ready" : "loading" });

  try {
    const chunks = chunk(symbols, 100);
    const results = await Promise.all(
      chunks.map((batch) => fetchQuotes(batch, controller.signal)),
    );

    const nextQuotes: QuoteMap = { ...snapshot.quotes };
    const missing: string[] = [];
    for (const r of results) {
      for (const q of r.quotes ?? []) nextQuotes[q.symbol] = q;
      missing.push(...(r.missing ?? []));
    }

    backoffMs = MIN_INTERVAL_MS;
    commit({
      quotes: nextQuotes,
      status: "ready",
      error: null,
      asOf: new Date().toISOString(),
      missing,
    });
  } catch (err) {
    if (controller.signal.aborted) return;
    const message = err instanceof Error ? err.message : "Could not load quotes.";
    const rateLimited = /429|rate limit|too many/i.test(message);
    backoffMs = rateLimited ? MAX_BACKOFF_MS : Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    // Never clear good data on a failed poll — a stale price with an asOf
    // beats a blank table.
    commit({ status: "error", error: message });
    if (pollTimer) scheduleNext(backoffMs);
  } finally {
    inFlight = null;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
