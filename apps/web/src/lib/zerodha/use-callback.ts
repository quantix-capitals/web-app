"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveSession } from "./local-store";
import type { KiteSession } from "./types";

/**
 * Completes a Kite login on whatever page Zerodha lands on.
 *
 * A Kite app has exactly one registered redirect URL, and which path it points
 * at is a console setting nobody can read from here — so any page that might be
 * the landing spot has to be able to finish the handshake. Dropping a valid
 * `request_token` because it arrived on the "wrong" route is a silent failure
 * that looks, from the outside, exactly like the login never happened.
 *
 * Returns the state of that attempt; a page with nothing to complete just gets
 * `status: "idle"` and renders normally.
 */
export type CallbackStatus = "idle" | "working" | "done" | "error";

export function useKiteCallback(): { status: CallbackStatus; error: string | null } {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<CallbackStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const requestToken = params.get("request_token");
  const kiteStatus = params.get("status");

  // A request token is single-use, so React's double-invoked effect in dev would
  // burn it on the first call and fail on the second.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;

    if (kiteStatus === "error") {
      started.current = true;
      setStatus("error");
      setError("Zerodha reported the sign-in was cancelled or expired.");
      return;
    }
    if (!requestToken) return; // Nothing to complete — an ordinary page view.

    started.current = true;
    setStatus("working");

    (async () => {
      try {
        const res = await fetch("/api/zerodha/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_token: requestToken }),
        });
        const body = (await res.json()) as KiteSession & { error?: string };

        if (!res.ok) {
          setStatus("error");
          setError(body.error ?? "Could not complete the connection.");
          return;
        }
        saveSession(body);
        setStatus("done");
        // Drop the token from the address bar: it is spent, and leaving it there
        // means a refresh retries a dead token and shows a spurious failure.
        router.replace("/portfolio");
      } catch {
        setStatus("error");
        setError("Could not reach the server to finish connecting.");
      }
    })();
  }, [requestToken, kiteStatus, router]);

  return { status, error };
}
