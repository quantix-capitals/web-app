"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, refresh, retain, subscribe } from "./quote-store";
import type { QuoteMap } from "./types";

export interface UseQuotes {
  quotes: QuoteMap;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  asOf: string | null;
  missing: string[];
  refresh: () => void;
}

/** Retains a set of Yahoo symbols against the shared quote store. */
export function useQuotes(yahooSymbols: string[]): UseQuotes {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // The dep is the joined string, not the array — callers build a new array
  // every render, which would otherwise re-run this effect every render too.
  const key = yahooSymbols.join(",");

  useEffect(() => {
    if (!key) return;
    return retain(key.split(","));
  }, [key]);

  return {
    quotes: snapshot.quotes,
    status: snapshot.status,
    error: snapshot.error,
    asOf: snapshot.asOf,
    missing: snapshot.missing,
    refresh: () => void refresh(),
  };
}
