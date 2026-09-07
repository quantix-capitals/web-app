"use client";

import { useActionState } from "react";
import { ActionStyle } from "@/components/ui/primitives";
import { sendMagicLink, type SendMagicLinkState } from "@/lib/supabase/actions";

const initialState: SendMagicLinkState = { status: "idle" };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <p className="text-body text-ink">
        Check your email for a sign-in link. It expires shortly, so use it soon.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full max-w-sm rounded-md border border-line-strong bg-canvas px-3 py-2 text-body text-ink outline-none focus:border-accent"
        />
        {state.status === "error" ? (
          <p className="mt-2 text-detail text-loss">{state.error}</p>
        ) : null}
      </div>
      <button type="submit" disabled={pending} className={ActionStyle()}>
        {pending ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
