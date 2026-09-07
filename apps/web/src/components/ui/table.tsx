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
}: {
  children?: ReactNode;
  align?: "left" | "right";
  /** Carries the page gutter on the first and last column. */
  first?: boolean;
  last?: boolean;
  srOnly?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-3 font-medium",
        align === "left" ? "text-left" : "text-right",
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
}: {
  children: ReactNode;
  align?: "left" | "right";
  first?: boolean;
  last?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-3 py-3.5 align-middle",
        align === "left" ? "text-left" : "text-right tabular-nums",
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
