import type { ReactNode } from "react";

/**
 * The one header every route wears, so pages line up vertically. It shares the
 * page gutter with every section below it, and its own rule is the first of the
 * hairlines that divide the page.
 *
 * The title is set in the serif — the single strongest signal that this is a
 * document about money rather than a control panel.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line px-6 py-5">
      <div className="min-w-0">
        <h1 className="font-serif text-title tracking-tight text-ink">{title}</h1>
        {subtitle ? (
          <p className="mt-1 max-w-[68ch] text-detail leading-relaxed text-ink-muted">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
