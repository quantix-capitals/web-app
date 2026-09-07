import type { ReactNode } from "react";
import { Dot } from "@/components/ui/primitives";

/**
 * The band at the top of the desk. Deliberately the same height as the
 * `PageHeader` every other route wears — this is a console, and a screen-height
 * centred splash pushes the first real figure below the fold.
 *
 * The WebGL activation band and the pulsing status dot are both parked;
 * `hero-canvas.tsx` stays on disk unimported so the band can come back.
 */
export function Hero({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-sunken">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-6 py-6">
        <div className="min-w-0">
          <h1 className="font-serif text-title tracking-tight text-ink">{title}</h1>
          {children ? (
            <p className="mt-1.5 max-w-[70ch] text-detail leading-relaxed text-ink-muted">
              {children}
            </p>
          ) : null}
          {eyebrow ? (
            <div className="mt-2.5 inline-flex items-center gap-2 text-meta text-ink-subtle">
              <Dot tone="accent" />
              {eyebrow}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
