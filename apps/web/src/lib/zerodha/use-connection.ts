"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  disconnect,
  getServerSnapshot,
  getSnapshot,
  saveHoldings,
  subscribe,
} from "./local-store";
import type { KiteHolding, ZerodhaConnection } from "./types";

export interface Connection {
  connection: ZerodhaConnection | null;
  connected: boolean;
  /** True while holdings are in flight. */
  syncing: boolean;
  /** Last sync failure, already readable. Null once a sync succeeds. */
  error: string | null;
  /** Set when Zerodha rejected the token — the fix is to connect again. */
  expired: boolean;
  refresh: () => Promise<void>;
  disconnect: () => void;
}

/** Reads the stored connection and pulls holdings through the server proxy. */
export function useZerodha(): Connection {
  const connection = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const token = connection?.session.access_token ?? null;

  const refresh = useCallback(async () => {
    if (!token) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/zerodha/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
      });
      const body = (await res.json()) as { holdings?: KiteHolding[]; error?: string };

      if (!res.ok) {
        setExpired(res.status === 401);
        setError(body.error ?? "Could not load holdings.");
        return;
      }
      setExpired(false);
      saveHoldings(body.holdings ?? []);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSyncing(false);
    }
  }, [token]);

  return {
    connection,
    connected: Boolean(connection),
    syncing,
    error,
    expired,
    refresh,
    disconnect,
  };
}
