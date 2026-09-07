import { useCallback, useState, useSyncExternalStore } from "react";
import {
  disconnect,
  getSnapshot,
  saveHoldings,
  subscribe,
} from "./local-store";
import type { ZerodhaConnection } from "@stealth/shared";
import { FunctionError } from "@/services/functions";
import { fetchHoldings } from "@/services/zerodha-service";

export interface Connection {
  connection: ZerodhaConnection | null;
  connected: boolean;
  /** True while holdings are in flight. */
  syncing: boolean;
  /** Last sync failure, already readable. Null once a sync succeeds. */
  error: string | null;
  /** Set when Zerodha rejected the token — the fix is to connect again. */
  expired: boolean;
  /** Equity loaded but the mutual-funds endpoint did not. Null when both were fine. */
  mfError: string | null;
  refresh: () => Promise<void>;
  disconnect: () => void;
}

/** Reads the stored connection and pulls holdings through the server proxy. */
export function useZerodha(): Connection {
  const connection = useSyncExternalStore(subscribe, getSnapshot);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [mfError, setMfError] = useState<string | null>(null);

  const token = connection?.session.access_token ?? null;

  const refresh = useCallback(async () => {
    if (!token) return;
    setSyncing(true);
    setError(null);
    try {
      const body = await fetchHoldings(token);
      setExpired(false);
      setMfError(body.mfError);
      saveHoldings(body.holdings, body.mfHoldings);
    } catch (err) {
      // Kite expires every access token each morning, so a 401 here is the
      // ordinary case: it means "reconnect", not "something broke".
      setExpired(err instanceof FunctionError && err.status === 401);
      setError(err instanceof Error ? err.message : "Could not load holdings.");
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
    mfError,
    refresh,
    disconnect,
  };
}
