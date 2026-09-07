import Link from "next/link";
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
 * What changed with the "quiet ledger" palette is colour and type, not this
 * structure. Every component reads the semantic tokens in globals.css and never
 * names a shade, which is what lets light and dark be one design.
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
      className={cn(!flush && "border-b border-line", id && "scroll-mt-21", className)}
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
    // A header is chrome, and chrome should be told apart from content by where
    // it sits, not by being the loudest thing in the panel. It gets its own
    // sunken band closed by a rule, and gives the ink back to the content —
    // the figure, the score, the position — which is what should read first.
    <div
      className={cn(
        "flex items-start justify-between gap-4 bg-sunken py-3.5",
        SECTION_X,
        rule && "border-b border-line",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-lead font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 max-w-[70ch] text-detail leading-relaxed text-ink-muted">
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/**
 * Columns told apart by a vertical rule instead of a gap — two lists sitting
 * side by side. Stacks into horizontal rules below the breakpoint.
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
        "grid divide-y divide-line",
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
 * phone — and the rules follow the wrap. `divide-y` cannot do this on its own:
 * it draws a rule above every cell but the first, which in a two-column grid
 * means seams inside the first row. So the wrapped row's rule is drawn where
 * the wrap actually happens.
 */
export function StatBand({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid divide-y divide-line",
        "sm:grid-cols-2 sm:divide-x sm:divide-y-0",
        "sm:max-lg:[&>*:nth-child(n+3)]:border-t sm:max-lg:[&>*:nth-child(n+3)]:border-line",
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

const TONE_BADGE: Record<Tone, string> = {
  neutral: "border-line bg-sunken text-ink-muted",
  accent: "border-accent-line bg-accent-soft text-accent-ink",
  gain: "border-transparent bg-gain-soft text-gain",
  loss: "border-transparent bg-loss-soft text-loss",
  warn: "border-transparent bg-warn-soft text-warn",
  info: "border-transparent bg-info-soft text-info",
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
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// --- Dot --------------------------------------------------------------------

const TONE_FILL: Record<Tone, string> = {
  neutral: "bg-ink-subtle",
  accent: "bg-accent",
  gain: "bg-gain",
  loss: "bg-loss",
  warn: "bg-warn",
  info: "bg-info",
};

export function Dot({ tone = "neutral" }: { tone?: Tone }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-1.5 shrink-0 rounded-full", TONE_FILL[tone])}
    />
  );
}

// --- Meter ------------------------------------------------------------------

export function Meter({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden bg-sunken", className)}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full transition-[width] duration-500", TONE_FILL[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// --- Tabs -------------------------------------------------------------------

export interface TabSpec<T extends string> {
  id: T;
  label: string;
  /** Rendered as a quiet count beside the label. */
  count?: number;
}

/**
 * Peer views of one dataset. Underlined rather than a segmented pill: a capsule
 * would be the only floating rounded thing on a page built from straight rules,
 * and the underline lands on the section rule the strip already sits on.
 */
export function Tabs<T extends string>({
  active,
  onChange,
  tabs,
  className,
}: {
  active: T;
  onChange: (id: T) => void;
  tabs: Array<TabSpec<T>>;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-6 bg-sunken", SECTION_X, className)}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 py-3 text-body font-medium transition",
              on
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" ? (
              <span
                className={cn(
                  "text-meta tabular-nums",
                  on ? "text-accent-ink" : "text-ink-subtle",
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
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
      <div
        className={cn("flex items-start gap-3 py-5 text-detail text-ink-muted", SECTION_X)}
      >
        {/* Aligned to the first line rather than to the block, so the rule still
            points at the sentence when the sentence wraps. */}
        <span aria-hidden className="mt-2.5 h-px w-5 shrink-0 bg-line-strong" />
        <span className="max-w-[80ch] leading-relaxed">{children}</span>
      </div>
    );
  }
  return (
    <div className="flex min-h-24 items-center justify-center px-6 py-10 text-center text-detail text-ink-muted">
      {children}
    </div>
  );
}

/**
 * The centred void a whole page shows before it has anything to show: one line
 * of what this page is for, and the one action that gets it there.
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
    <div className="flex min-h-[44vh] flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? (
        <div className="mb-5 flex size-12 items-center justify-center border border-line bg-sunken text-ink-subtle">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lead font-semibold tracking-tight text-ink">{title}</h3>
      {children ? (
        <p className="mt-2 max-w-[54ch] text-detail leading-relaxed text-ink-muted">
          {children}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

// --- Stat -------------------------------------------------------------------

const TONE_FIGURE: Record<Tone, string> = {
  neutral: "text-ink",
  accent: "text-accent-ink",
  gain: "text-gain",
  loss: "text-loss",
  warn: "text-warn",
  info: "text-info",
};

/**
 * One measured number. The figure is set in the serif — it is the thing on the
 * page worth reading, and a serif numeral carries more weight than the same
 * number in the interface sans.
 */
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
  return (
    <div className={cn("py-5", SECTION_X)}>
      <div className="text-meta font-medium tracking-wide text-ink-muted">{label}</div>
      <div className={cn("mt-2 font-serif text-figure tabular-nums", TONE_FIGURE[tone])}>
        {value}
      </div>
      {hint ? <div className="mt-2 text-detail text-ink-subtle">{hint}</div> : null}
    </div>
  );
}

/**
 * The page's totals, read at a glance rather than declaimed. Deliberately not a
 * StatBand: this sits beside tabs or a header, so the figures stay at body size
 * in the sans and let the table below them be the loud thing.
 */
export function StatInline({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }>;
  className?: string;
}) {
  return (
    <dl className={cn("flex flex-wrap items-center gap-x-8 gap-y-2 text-body", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <dt className="text-meta tracking-wide text-ink-subtle">{item.label}</dt>
          <dd
            className={cn(
              "flex items-baseline gap-1.5 font-medium tabular-nums",
              TONE_FIGURE[item.tone ?? "neutral"],
            )}
          >
            {item.value}
            {item.hint ? (
              <span className="text-meta font-normal opacity-80">{item.hint}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// --- Button -----------------------------------------------------------------

/**
 * A link that looks like the primary action. Buttons that *do* something are
 * written where they act; this is the shape they all share. Radius lives here
 * and nowhere else — it is the signal that a thing is pressable.
 */
export function ActionStyle({
  variant = "primary",
}: { variant?: "primary" | "ghost" | "quiet" } = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-body font-medium transition",
    variant === "primary" && "bg-accent text-on-accent hover:bg-accent-hover",
    variant === "ghost" && "border border-line-strong text-ink hover:bg-sunken",
    variant === "quiet" && "text-ink-muted hover:bg-sunken hover:text-ink",
  );
}

/**
 * The way back up one level. A drawn chevron in a square hit area, not a "←"
 * glyph on a text baseline: the glyph sat a hair below the title it preceded,
 * had no target to speak of, and rendered at a different weight in every font
 * that happened to be installed.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="-ml-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition hover:bg-sunken hover:text-ink"
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        <path d="M10 3.5 5.5 8l4.5 4.5" />
      </svg>
    </Link>
  );
}

// --- Form -------------------------------------------------------------------

/** Every text field on the product, so a modal and a toolbar agree on height. */
export function FieldStyle(): string {
  return "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-body text-ink outline-none transition placeholder:text-ink-subtle focus:border-accent";
}

export function Field({
  label,
  htmlFor,
  count,
  children,
}: {
  label: string;
  htmlFor: string;
  /** A live length against its cap, for capped fields. */
  count?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-meta font-medium tracking-wide text-ink-muted" htmlFor={htmlFor}>
          {label}
        </label>
        {count ? <span className="text-meta tabular-nums text-ink-subtle">{count}</span> : null}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** A checkbox with its explanation, as one target. */
export function CheckField({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-sunken px-3 py-2.5 transition hover:border-line-strong">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-accent"
      />
      <span className="text-body text-ink">
        {label}
        {children ? (
          <span className="mt-1 block text-detail leading-relaxed text-ink-muted">{children}</span>
        ) : null}
      </span>
    </label>
  );
}
