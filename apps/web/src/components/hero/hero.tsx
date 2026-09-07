import type { ReactNode } from "react";
import { Dot } from "@/components/ui/primitives";

/**
 * The band at the top of the desk. Deliberately the same height as the
 * `PageHeader` every other route wears — this is a console, and a screen-height
 * centred splash pushes the first real figure below the fold.
 *
 * The WebGL activation band and the pulsing status dot are both parked for now;
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
    <div className="relative isolate overflow-hidden border-b border-base-850">
      <div aria-hidden className="grid-fade absolute inset-0 -z-20" />

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-6 py-5">
        <div className="min-w-0">
          <h1 className="text-lead font-semibold tracking-tight text-base-100">{title}</h1>
          {children ? (
            <p className="mt-1 max-w-[70ch] text-detail leading-relaxed text-base-500">
              {children}
            </p>
          ) : null}
          {eyebrow ? (
            <div className="mt-2 inline-flex items-center gap-1.5 text-meta text-base-500">
              <Dot tone="ember" />
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
