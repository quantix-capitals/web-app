"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ActionStyle, EmptyState, Section } from "@/components/ui/primitives";
import Link from "next/link";
import { saveSession } from "@/lib/zerodha/local-store";
import type { KiteSession } from "@/lib/zerodha/types";

/**
 * Where Zerodha lands the user after login — register this path as the redirect
 * URL on the Kite app. It exchanges the request token, writes the session to
 * localStorage, and moves on to the portfolio. Nothing to click.
 */
export default function ZerodhaCallbackPage() {
  return (
    <Suspense fallback={<Working />}>
      <Callback />
    </Suspense>
  );
}

function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const requestToken = params.get("request_token");
  const kiteStatus = params.get("status");

  // A request token is single-use, so React 18's double-invoked effect in dev
  // would burn it on the first call and fail on the second.
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    if (kiteStatus === "error" || !requestToken) {
      setError("Zerodha did not return a login token. The sign-in was cancelled or expired.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/zerodha/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_token: requestToken }),
        });
        const body = (await res.json()) as KiteSession & { error?: string };

        if (!res.ok) {
          setError(body.error ?? "Could not complete the connection.");
          return;
        }
        saveSession(body);
        router.replace("/portfolio");
      } catch {
        setError("Could not reach the server to finish connecting.");
      }
    })();
  }, [kiteStatus, requestToken, router]);

  if (error) {
    return (
      <div className="bg-canvas">
        <Section flush>
          <EmptyState
            title="Zerodha connection failed"
            action={
              <Link href="/portfolio" className={ActionStyle()}>
                Back to portfolio
              </Link>
            }
          >
            {error}
          </EmptyState>
        </Section>
      </div>
    );
  }

  return <Working />;
}

function Working() {
  return (
    <div className="bg-canvas">
      <Section flush>
        <EmptyState title="Connecting to Zerodha">
          Finishing the handshake and reading your holdings. This takes a second.
        </EmptyState>
      </Section>
    </div>
  );
}
