/**
 * The pieces every panel on the dashboard is assembled from.
 *
 * A panel is a titled region with a chart in it — same rules as the rest of the
 * product: no card, no shadow, no radius, told apart from its neighbour by a
 * hairline. What it adds over `Section` is the three things a chart needs and a
 * table doesn't: a legend that is real DOM rather than something Highcharts
 * draws, a reading of what the chart is *for*, and a slot for the caveat that
 * belongs under it rather than in a tooltip.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { SECTION_X } from "@/components/ui/primitives";
import type { Tone } from "@/lib/types";

export function Panel({
  title,
  reading,
  legend,
  note,
  children,
  className,
}: {
  title: string;
  /** What this chart is for, in one line. Not a restatement of the title. */
  reading?: ReactNode;
  legend?: ReactNode;
  /** The caveat, under the chart, where a reader who got that far will want it. */
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-5", SECTION_X, className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-body font-semibold tracking-tight text-ink">{title}</h3>
          {reading ? (
            <p className="mt-0.5 max-w-[68ch] text-detail leading-relaxed text-ink-muted">
              {reading}
            </p>
          ) : null}
        </div>
        {legend ? <div className="shrink-0">{legend}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
      {note ? <p className="mt-3 text-meta leading-relaxed text-ink-subtle">{note}</p> : null}
    </div>
  );
}

/**
 * The legend, built here rather than by Highcharts.
 *
 * It is always present when a chart has two or more series — identity never
 * rests on colour alone — and it mirrors the mark: a stroke for a line, a
 * dashed stroke for a dashed line, a filled block for a column or an area. A
 * chart with one series gets none: there is only one colour, and the title
 * already names it.
 */
export function Legend({
  items,
}: {
  items: Array<{ label: string; color: string; shape?: "line" | "dashed" | "block" }>;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-meta text-ink-muted">
          <Key color={item.color} shape={item.shape ?? "line"} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function Key({ color, shape }: { color: string; shape: "line" | "dashed" | "block" }) {
  if (shape === "block") {
    return (
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-[2px]"
        style={{ background: color }}
      />
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 16 4" className="h-1 w-4 overflow-visible">
      <line
        x1="0"
        y1="2"
        x2="16"
        y2="2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={shape === "dashed" ? "5 3" : undefined}
      />
    </svg>
  );
}

/**
 * A compact measured figure — the dashboard shows around twenty of these, and
 * `Stat` at 28px serif is built for four. Same contract, quarter of the weight.
 */
export function Metric({
  label,
  value,
  hint,
  tone = "neutral",
  title,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  /** The one-line definition, on hover. The method note carries the long form. */
  title?: string;
}) {
  const toneClass: Record<Tone, string> = {
    neutral: "text-ink",
    accent: "text-accent-ink",
    gain: "text-gain",
    loss: "text-loss",
    warn: "text-warn",
    info: "text-info",
  };
  return (
    <div className="py-3.5" title={title}>
      <dt className="text-meta tracking-wide text-ink-subtle">{label}</dt>
      <dd className={cn("mt-1 text-lead font-semibold tabular-nums", toneClass[tone])}>{value}</dd>
      {hint ? <div className="mt-0.5 text-meta text-ink-subtle tabular-nums">{hint}</div> : null}
    </div>
  );
}

/** A run of `Metric`s on the page's gutter, wrapping to as many as fit. */
export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-8 sm:grid-cols-3 lg:grid-cols-6",
        "py-1.5",
        SECTION_X,
      )}
    >
      {children}
    </dl>
  );
}

/** The line under a chart that says why it is empty, instead of an empty chart. */
export function NotEnough({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-30 items-center justify-center border border-dashed border-line px-6 py-8 text-center text-detail text-ink-muted">
      <span className="max-w-[60ch]">{children}</span>
    </div>
  );
}
