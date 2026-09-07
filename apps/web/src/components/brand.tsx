import Link from "next/link";
import { cn } from "@/lib/format";

/**
 * Stealth: a breakout mark — a rising leg clearing a base, the shape the whole
 * product looks for. Rename in one place if the product name changes.
 */
export function StealthMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-7", className)}
    >
      <defs>
        <linearGradient id="stealth-leg" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-ember-600)" />
          <stop offset="100%" stopColor="var(--color-ember-300)" />
        </linearGradient>
      </defs>
      {/* the base it breaks out of */}
      <path
        d="M3.5 21.5h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* the leg */}
      <path
        d="M9.5 21.5 15 15.5l3.5 3.5L27 9"
        stroke="url(#stealth-leg)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the target it prints into */}
      <path
        d="M21.5 9H27v5.5"
        stroke="var(--color-ember-300)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="15.5" r="1.4" fill="var(--color-base-950)" />
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
      href={href}
      className="group flex min-w-0 items-center gap-2"
      aria-label="Stealth — home"
    >
      <StealthMark className="size-5.5 shrink-0 text-base-500 transition-colors group-hover:text-base-200" />
      {compact ? null : (
        <span className="truncate text-[15px] leading-none font-semibold tracking-tight text-base-100">
          Stealth<span className="font-normal text-base-400"> Mode</span>
        </span>
      )}
    </Link>
  );
}
