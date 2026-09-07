"use client";

import { ActionStyle } from "@/components/ui/primitives";
import { cn } from "@/lib/format";

/**
 * The whole connect flow, from the user's side: one click. The button is a plain
 * navigation to `/api/zerodha/login`, which redirects on to Zerodha — a full
 * page load rather than a fetch, because the OAuth handshake has to happen in the
 * address bar for the redirect back to work.
 */
export function ConnectZerodhaButton({
  variant = "primary",
  label = "Connect Zerodha",
  className,
}: {
  variant?: "primary" | "ghost";
  label?: string;
  className?: string;
}) {
  return (
    <a href="/api/zerodha/login" className={cn(ActionStyle({ variant }), className)}>
      <KiteMark className="size-4" />
      {label}
    </a>
  );
}

/** Zerodha's kite, drawn as a plain glyph so it inherits the button's ink. */
function KiteMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M8 1.5 13.5 6 8 12 2.5 6z" />
      <path d="M8 12v3" strokeLinecap="round" />
    </svg>
  );
}
