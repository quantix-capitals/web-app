"use client";

/**
 * The Zerodha connection, kept in localStorage. Deliberately local: nothing here
 * is written to Supabase yet, so a connection lives and dies in one browser.
 *
 * Same shape as `components/shell/sidebar-store` — an external store read through
 * `useSyncExternalStore`, so the server render and the hydration pass both see
 * "not connected" and the stored value swaps in without a setState-in-effect.
 */

import type { KiteHolding, KiteSession, ZerodhaConnection } from "./types";

const KEY = "stealth:zerodha";

let listeners: Array<() => void> = [];
/** `undefined` means "not read from storage yet"; `null` means "read, nothing there". */
let cached: ZerodhaConnection | null | undefined;

export function subscribe(cb: () => void): () => void {
  listeners = [...listeners, cb];
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export function getSnapshot(): ZerodhaConnection | null {
  if (cached === undefined) {
    cached = read();
  }
  return cached;
}

/** Server render (and hydration) always starts disconnected. */
export function getServerSnapshot(): ZerodhaConnection | null {
  return null;
}

function read(): ZerodhaConnection | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ZerodhaConnection;
    // A hand-edited or half-written entry should read as "not connected" rather
    // than crash every component that renders it.
    return parsed?.session?.access_token ? parsed : null;
  } catch {
    return null;
  }
}

function commit(next: ZerodhaConnection | null) {
  cached = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage disabled — the connection just won't survive a reload.
  }
  for (const l of listeners) l();
}

export function saveSession(session: KiteSession) {
  commit({
    session,
    holdings: [],
    synced_at: null,
    connected_at: new Date().toISOString(),
  });
}

export function saveHoldings(holdings: KiteHolding[]) {
  const current = getSnapshot();
  if (!current) return;
  commit({ ...current, holdings, synced_at: new Date().toISOString() });
}

export function disconnect() {
  commit(null);
}
