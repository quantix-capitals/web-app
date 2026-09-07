"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Dot } from "@/components/ui/primitives";

// three.js is dead weight until the hero paints — and it needs a DOM, so no SSR pass.
const HeroCanvas = dynamic(() => import("./hero-canvas").then((m) => m.HeroCanvas), {
  ssr: false,
});

/**
 * The band at the top of the desk. The canvas dissolves at every edge (see
 * `.hero-webgl`) so the type below sits on flat ground.
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
      <HeroCanvas className="hero-webgl pointer-events-none absolute top-0 left-1/2 -z-10 h-[150px] w-[min(1100px,124vw)] -translate-x-1/2 sm:h-[190px]" />

      <div className="px-6 py-14 text-center sm:py-20">
        {eyebrow ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-base-800 bg-base-950/60 px-2.5 py-1 text-meta text-base-400 backdrop-blur">
            <Dot tone="ember" pulse />
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mx-auto max-w-[22ch] text-2xl font-semibold tracking-tight text-base-100 text-balance sm:text-3xl">
          {title}
        </h1>
        {children ? (
          <p className="mx-auto mt-3 max-w-[58ch] text-body leading-relaxed text-base-500 text-pretty">
            {children}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
