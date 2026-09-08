import { cn } from "@/lib/format";
import { SECTION_X } from "./primitives";
import { Td, Tr } from "./table";

/**
 * What the page shows before its figures arrive.
 *
 * The rule here is that a skeleton is a *tracing* of the thing it stands in
 * for, not a generic placeholder: same gutter, same column widths, same row
 * height, so the content lands without the page moving under the reader. That
 * is the whole reason these replaced the "Loading…" line — the line was honest
 * but it was also a different shape from the ledger it preceded, so every load
 * ended in a jump.
 *
 * Two consequences worth knowing before adding to this file.
 *
 * 1. **Skeletons reuse the real components.** The rows below are built from
 *    `Tr`/`Td`, and a loading figure is passed straight into a real `Stat`. A
 *    skeleton that re-implements the layout it imitates drifts from it within a
 *    release; one that borrows the layout cannot.
 * 2. **Only what is genuinely unknown gets a bar.** Static text — the page
 *    title, the column headers, the tab labels — stays real while loading.
 *    Blanking out text we already have buys nothing and costs the reader their
 *    place on the page.
 */

/** One placeholder bar. Sized by the caller, because only the caller knows the shape. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      // Corners are near-square: radius in this system means "you can click or
      // type into this", and a skeleton is neither.
      className={cn("block animate-pulse rounded-xs bg-line", className)}
    />
  );
}

/**
 * A bar standing in for a figure inside a real `Stat` or `StatInline`.
 *
 * Height matches the serif figure it replaces rather than the bar's own
 * content, so the stat band is exactly as tall loading as loaded.
 */
export function SkeletonFigure({ className }: { className?: string }) {
  return <Skeleton className={cn("my-1 h-6 w-28", className)} />;
}

/** A bar for a numeric table cell — right-aligned, like every figure column. */
export function SkeletonCell({ className }: { className?: string }) {
  return <Skeleton className={cn("ml-auto h-3.5 w-16", className)} />;
}

/**
 * One column of a skeleton table body, described in the same terms as the `Td`
 * it will render as.
 *
 * `width` accepts a list, which is cycled down the rows: real names and figures
 * are not all the same length, and a column of identical bars reads as a
 * rendering artefact rather than as text that hasn't arrived.
 */
export interface SkeletonColumn {
  /** `null` draws an empty cell — for a column whose real content is a hover-only action. */
  width: string | string[] | null;
  align?: "left" | "right";
  grow?: boolean;
  tight?: boolean;
  first?: boolean;
  last?: boolean;
  /** The second line, where the real cell has one — a relative date, a percentage. */
  sub?: string;
}

/**
 * The `<tbody>` of a table that hasn't loaded. Pair it with the real `<Table>`
 * and `<HeadRow>`, so the headers stay readable and the column count can't
 * drift from the table it stands in for.
 */
export function SkeletonRows({
  columns,
  rows = 4,
}: {
  columns: SkeletonColumn[];
  rows?: number;
}) {
  return (
    <tbody aria-busy="true">
      {Array.from({ length: rows }, (_, row) => (
        <Tr key={row}>
          {columns.map((col, i) => (
            <Td
              key={i}
              align={col.align ?? "right"}
              first={col.first}
              last={col.last}
              grow={col.grow}
              tight={col.tight}
            >
              {col.width === null ? null : (
                <Skeleton
                  className={cn(
                    "h-3.5",
                    widthAt(col.width, row),
                    (col.align ?? "right") === "right" && "ml-auto",
                  )}
                />
              )}
              {col.sub ? (
                <Skeleton
                  className={cn(
                    "mt-1.5 h-2.5",
                    col.sub,
                    (col.align ?? "right") === "right" && "ml-auto",
                  )}
                />
              ) : null}
            </Td>
          ))}
        </Tr>
      ))}
    </tbody>
  );
}

function widthAt(width: string | string[], row: number): string {
  return Array.isArray(width) ? width[row % width.length] : width;
}

/**
 * The route-level fallback, shown while a page's chunk is still downloading.
 *
 * This one cannot trace anything, because which page is arriving is the very
 * thing not yet known — so it draws the two things every route in this app has:
 * a header, and a list of rows under it. It is deliberately the least specific
 * skeleton in the file; a page that knows its own shape should say so with its
 * own, the way the watchlist and basket pages do.
 */
export function PageSkeleton() {
  return (
    <div className="bg-canvas" role="status" aria-label="Loading">
      <header className={cn("border-b border-line py-5", SECTION_X)}>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="mt-3 h-3 w-80 max-w-full" />
      </header>
      <div className={cn("divide-y divide-line/70", SECTION_X)}>
        {["w-56", "w-40", "w-64", "w-48", "w-44"].map((width, i) => (
          <div key={i} className="flex items-center justify-between gap-6 py-4">
            <Skeleton className={cn("h-3.5", width, "max-w-full")} />
            <Skeleton className="h-3.5 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
