import { useState, type FormEvent } from "react";
import { ActionStyle } from "@/components/ui/primitives";
import { useAuth } from "@/context/auth-context";

/**
 * Magic link, and nothing else. There is no password to get wrong, no password
 * to store, and no reset flow to build — the mailbox is the credential.
 */
export function SignInForm() {
  const { sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      await sendMagicLink(email);
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <p className="text-body text-ink">
        Check your email for a sign-in link. It expires shortly, so use it soon.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <input
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full max-w-sm rounded-md border border-line-strong bg-canvas px-3 py-2 text-body text-ink outline-none focus:border-accent"
        />
        {error ? <p className="mt-2 text-detail text-loss">{error}</p> : null}
      </div>
      <button type="submit" disabled={state === "sending"} className={ActionStyle()}>
        {state === "sending" ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
