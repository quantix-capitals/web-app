import type { ReactNode } from "react";
import { cn } from "@/lib/format";

/**
 * The one table on this product.
 *
 * It is quiet on purpose: no zebra striping, no coloured rules, no left-edge
 * accent bar. Striping fights the colour that actually carries meaning here —
 * gain and loss in the figures — and on a dark ground it turned every table
 * into a set of bands you read before you read the numbers. What separates
 * rows is a hairline and enough height to breathe; what separates *columns* is
 * alignment, which is why every numeric column is right-aligned and tabular.
 */

export function Table({ children, minWidth = "min-w-220" }: { children: ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-body", minWidth)}>{children}</table>
    </div>
  );
}

/**
 * Where a wide screen's slack goes.
 *
 * `table-layout: auto` shares surplus width between every column, which on a
 * 2000px display pushes a basket's name and its value to opposite ends of the
 * screen with a lake of nothing in between — the two figures you are meant to
 * read together end up further apart than any two things on the page. A ledger
 * does the opposite: one column absorbs the slack (the name), and every figure
 * stays shrink-to-fit and clustered at the right margin, so the eye travels
 * down a tight block of numbers instead of across an empty one.
 *
 * `w-px` is the idiom for that: a width the content always exceeds, which auto
 * layout resolves to "as narrow as this column's content allows".
 */
const GROW = "w-full";
/**
 * `max-w-0` on the growing *cell* is what makes `truncate` inside it work at
 * all. A table column is at least as wide as its widest content, and a nowrap
 * line of text reports its full length as that minimum — so an untruncated
 * description silently widens the table past its container and hands the page a
 * horizontal scrollbar. Zero max-width breaks that feedback loop: the column
 * takes the surplus `w-full` gives it, and its contents fit themselves to it.
 */
const GROW_CELL = "w-full max-w-0";
const TIGHT = "w-px whitespace-nowrap";

export function HeadRow({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-line text-meta tracking-wide text-ink-subtle">{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  align = "right",
  first,
  last,
  srOnly,
  grow,
  tight,
}: {
  children?: ReactNode;
  align?: "left" | "right";
  /** Carries the page gutter on the first and last column. */
  first?: boolean;
  last?: boolean;
  srOnly?: boolean;
  /** The one column that absorbs a wide screen's surplus width. */
  grow?: boolean;
  /** Shrink-to-fit — every figure column. */
  tight?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-3 font-medium",
        align === "left" ? "text-left" : "text-right",
        grow && GROW,
        tight && TIGHT,
        first && "pl-6",
        last && "pr-6",
      )}
    >
      {srOnly ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

/**
 * `group` so a row's actions can stay invisible until the row is pointed at —
 * a Delete on every line of a list is a lot of red intent for a page you are
 * mostly just reading.
 */
export function Tr({
  children,
  dimmed,
}: {
  children: ReactNode;
  dimmed?: boolean;
}) {
  return (
    <tr
      className={cn(
        "group border-b border-line/70 transition-colors last:border-b-0 hover:bg-sunken",
        dimmed && "pointer-events-none opacity-45",
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = "right",
  first,
  last,
  className,
  grow,
  tight,
}: {
  children: ReactNode;
  align?: "left" | "right";
  first?: boolean;
  last?: boolean;
  className?: string;
  grow?: boolean;
  tight?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-3 py-3.5 align-middle",
        align === "left" ? "text-left" : "text-right tabular-nums",
        grow && GROW_CELL,
        tight && TIGHT,
        first && "pl-6",
        last && "pr-6",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** The second line in a cell — a relative date, a share count, a percentage. */
export function Sub({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-0.5 text-meta text-ink-subtle", className)}>{children}</div>;
}

/** A row action: present but recessive until you reach for it. */
export function RowAction({
  children,
  onClick,
  disabled,
  onBlur,
  danger,
  armed,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  onBlur?: () => void;
  danger?: boolean;
  /** A destructive action awaiting its second click stays visible and coloured. */
  armed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onBlur={onBlur}
      disabled={disabled}
      className={cn(
        "rounded-md px-2 py-1 text-meta font-medium whitespace-nowrap transition",
        "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
        armed && "opacity-100",
        armed
          ? "bg-loss-soft text-loss"
          : danger
            ? "text-ink-subtle hover:bg-loss-soft hover:text-loss"
            : "text-ink-subtle hover:bg-canvas hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
