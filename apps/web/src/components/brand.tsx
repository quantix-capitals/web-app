import { Link } from "react-router-dom";
import { cn } from "@/lib/format";

/**
 * Stealth: a rising leg clearing a base — the shape the whole product looks for.
 *
 * Redrawn flat for this theme. The old mark used a two-stop molten gradient,
 * which was the loudest thing on any page it appeared on; a single stroke in
 * the accent says the same thing quietly and inverts correctly in dark mode.
 */
export function StealthMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-7", className)}
    >
      {/* the base it breaks out of */}
      <path d="M4 22h5.5" opacity="0.4" />
      {/* the leg */}
      <path d="M9.5 22 15 16l3.5 3.5L26.5 11" />
      {/* the target it prints into */}
      <path d="M21 11h5.5v5.5" />
    </svg>
  );
}

export function Wordmark({
  href = "/",
  compact,
}: {
  href?: string;
  /** Mark only — used by the collapsed sidebar rail. */
  compact?: boolean;
}) {
  return (
    <Link
      to={href}
      className="group flex min-w-0 items-center gap-2.5"
      aria-label="Stealth — home"
    >
      <StealthMark className="size-5 shrink-0 text-accent" />
      {compact ? null : (
        <span className="truncate text-body leading-none font-semibold tracking-tight text-ink">
          Stealth<span className="font-normal text-ink-subtle"> Mode</span>
        </span>
      )}
    </Link>
  );
}
