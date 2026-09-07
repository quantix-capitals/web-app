import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import type { Tone } from "@/lib/types";

export type { Tone };

/**
 * Surfaces here are sections, not cards: nothing floats, nothing is rounded,
 * and regions are told apart by a hairline rule rather than by a border plus a
 * gap plus a tint. Radius is reserved for things you can click or type into.
 *
 * The horizontal rhythm is one number — SECTION_X — so a section header, a list
 * row and a table cell all start on the same vertical line down the page.
 *
 * Type comes from the named scale in globals.css (text-meta / detail / body /
 * lead / figure). Nothing here reaches for an arbitrary pixel size.
 */

// --- Section ----------------------------------------------------------------

/** The page's horizontal gutter. Every row and header uses it. */
export const SECTION_X = "px-6";

export function Section({
  children,
  className,
  as: Tag = "section",
  flush,
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
  /** Drop the closing rule — for the last section on a page. */
  flush?: boolean;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(!flush && "border-b border-base-850", id && "scroll-mt-21", className)}
    >
      {children}
    </Tag>
  );
}

export function SectionHeader({
  title,
  subtitle,
  right,
  className,
  rule = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
  /** A rule under the header, for sections whose body is a list or a table. */
  rule?: boolean;
}) {
  return (
    // A header is chrome, and chrome should be told apart from content by where it
    // sits, not by being the brightest thing in the panel. It gets its own raised
    // band closed by a rule, and gives the top of the ramp back to the content —
    // the figure, the score, the position — which is what should be brightest.
    <div
      className={cn(
        "flex items-start justify-between gap-4 bg-base-900 py-3",
        SECTION_X,
        rule && "border-b border-base-800",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-body font-semibold tracking-wide text-base-200">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 max-w-[68ch] text-meta leading-relaxed text-base-500">
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/**
 * Columns told apart by a vertical rule instead of a gap — two lists sitting side
 * by side. Stacks into horizontal rules below the breakpoint.
 */
export function SplitGrid({
  children,
  className,
  cols = 2,
}: {
  children: ReactNode;
  className?: string;
  cols?: 2 | 3 | 4;
}) {
  const at: Record<2 | 3 | 4, string> = {
    2: "sm:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  };
  return (
    <div
      className={cn(
        "grid divide-y divide-base-850",
        at[cols],
        cols === 3 ? "lg:divide-x lg:divide-y-0" : "sm:divide-x sm:divide-y-0 lg:divide-x",
        cols === 4 && "sm:max-lg:divide-y",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The row of figures at the head of a page.
 *
 * Four across on a wide screen, two then two in the middle, one per line on a
 * phone — and the rules follow the wrap. `divide-y` cannot do this on its own: it
 * draws a rule above every cell but the first, which in a two-column grid means
 * seams inside the first row. So the wrapped row's rule is drawn where the wrap
 * actually happens.
 */
export function StatBand({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid divide-y divide-base-850",
        "sm:grid-cols-2 sm:divide-x sm:divide-y-0",
        "sm:max-lg:[&>*:nth-child(n+3)]:border-t sm:max-lg:[&>*:nth-child(n+3)]:border-base-850",
        "lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

/** One line in a list section. Keeps every list on the same gutter and height. */
export function Row({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("py-3.5", SECTION_X, className)}>{children}</div>;
}

// --- Badge ------------------------------------------------------------------

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-base-700 bg-base-800/70 text-base-300",
  ember: "border-ember-600/40 bg-ember-600/12 text-ember-300",
  ok: "border-ok-500/35 bg-ok-500/12 text-ok-400",
  warn: "border-warn-500/35 bg-warn-500/12 text-warn-500",
  danger: "border-danger-500/40 bg-danger-500/12 text-danger-400",
  info: "border-info-500/35 bg-info-500/12 text-info-500",
  violet: "border-violet-500/35 bg-violet-500/12 text-violet-500",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  mono,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-meta font-medium leading-none whitespace-nowrap",
        mono && "font-mono",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// --- Dot --------------------------------------------------------------------

export function Dot({ tone = "neutral", pulse }: { tone?: Tone; pulse?: boolean }) {
  const bg: Record<Tone, string> = {
    neutral: "bg-base-600",
    ember: "bg-ember-500",
    ok: "bg-ok-500",
    warn: "bg-warn-500",
    danger: "bg-danger-500",
    info: "bg-info-500",
    violet: "bg-violet-500",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        bg[tone],
        pulse && "animate-pulse-ring",
      )}
    />
  );
}

// --- Meter ------------------------------------------------------------------

export function Meter({
  value,
  tone = "ember",
  className,
  label,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  label?: string;
}) {
  const fill: Record<Tone, string> = {
    neutral: "bg-base-400",
    ember: "bg-ember-500",
    ok: "bg-ok-500",
    warn: "bg-warn-500",
    danger: "bg-danger-500",
    info: "bg-info-500",
    violet: "bg-violet-500",
  };
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-base-850", className)}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fill[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// --- Empty ------------------------------------------------------------------

export function Empty({
  children,
  inline,
}: {
  children: ReactNode;
  /**
   * For anything that fills from the top — a section on a scrolling document, a
   * feed waiting on its first entry — where a centred void the height of a card
   * is just dead space. The centred form is for a region whose whole job is to
   * hold this one message.
   */
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className={cn("flex items-start gap-2.5 py-4 text-xs text-base-600", SECTION_X)}>
        {/* Aligned to the first line rather than to the block, so the rule still
            points at the sentence when the sentence wraps. */}
        <span aria-hidden className="mt-2 h-px w-5 shrink-0 bg-base-800" />
        <span className="max-w-[80ch]">{children}</span>
      </div>
    );
  }
  return (
    <div className="flex min-h-24 items-center justify-center px-6 py-8 text-center text-detail text-base-500">
      {children}
    </div>
  );
}

/**
 * The centred void a whole page shows before it has anything to show: one line of
 * what this page is for, and the one action that gets it there.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[46vh] flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-base-800 bg-base-900 text-base-600">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lead font-semibold tracking-tight text-base-200">{title}</h3>
      {children ? (
        <p className="mt-2 max-w-[54ch] text-detail leading-relaxed text-base-500">
          {children}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// --- Stat -------------------------------------------------------------------

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  const color: Record<Tone, string> = {
    neutral: "text-base-100",
    ember: "text-ember-400",
    ok: "text-ok-400",
    warn: "text-warn-500",
    danger: "text-danger-400",
    info: "text-info-500",
    violet: "text-violet-500",
  };
  return (
    <div className={cn("py-5", SECTION_X)}>
      <div className="text-meta font-medium uppercase tracking-[0.08em] text-base-500">
        {label}
      </div>
      <div className={cn("mt-2 text-figure font-semibold tabular-nums", color[tone])}>
        {value}
      </div>
      {hint ? <div className="mt-2 text-detail text-base-500">{hint}</div> : null}
    </div>
  );
}

// --- Button -----------------------------------------------------------------

/**
 * A link that looks like the primary action. Buttons that *do* something are
 * written where they act; this is the shape they all share.
 */
export function ActionStyle({
  variant = "primary",
}: { variant?: "primary" | "ghost" } = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-body font-semibold transition",
    variant === "primary"
      ? "bg-ember-500 text-base-950 hover:bg-ember-400"
      : "border border-base-800 text-base-300 hover:border-base-700 hover:text-base-100",
  );
}
