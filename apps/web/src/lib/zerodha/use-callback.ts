import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { saveSession } from "./local-store";
import { exchangeRequestToken } from "@/services/zerodha-service";

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
  const [params] = useSearchParams();
  const navigate = useNavigate();
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
        saveSession(await exchangeRequestToken(requestToken));
        setStatus("done");
        // Drop the token from the address bar: it is spent, and leaving it there
        // means a refresh retries a dead token and shows a spurious failure.
        navigate("/portfolio", { replace: true });
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Could not complete the connection.",
        );
      }
    })();
  }, [requestToken, kiteStatus, navigate]);

  return { status, error };
}
