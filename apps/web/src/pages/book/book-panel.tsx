/**
 * The Dashboard, Brief and Analyst views for any book of holdings.
 *
 * Each is a separate chunk: the dashboard and the run reports pull in Highcharts
 * and the analytics layer, and a reader who only ever opens the ledger should
 * never download either.
 */

import { lazy, Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { UseAnalyst } from "@/lib/analyst/use-analyst";
import type { WatchlistSummary } from "@/lib/watchlist/types";
import type { SharedView } from "./use-book-workspace";

const Dashboard = lazy(() =>
  import("../watchlist/dashboard/dashboard").then((m) => ({ default: m.Dashboard })),
);
const BriefView = lazy(() =>
  import("../watchlist/brief/brief-view").then((m) => ({ default: m.BriefView })),
);
const AnalystView = lazy(() =>
  import("../watchlist/analyst/analyst-view").then((m) => ({ default: m.AnalystView })),
);

export function BookPanel({
  view,
  list,
  analyst,
  onSelectRun,
  onOpenBrief,
  fallback,
}: {
  view: SharedView;
  list: WatchlistSummary;
  analyst: UseAnalyst;
  onSelectRun: (id: string) => void;
  onOpenBrief: () => void;
  fallback?: ReactNode;
}) {
  return (
    <Suspense fallback={fallback ?? <PanelFallback />}>
      {view === "dashboard" ? (
        <Dashboard list={list} />
      ) : view === "brief" ? (
        <BriefView list={list} />
      ) : (
        <AnalystView list={list} analyst={analyst} onSelect={onSelectRun} onOpenBrief={onOpenBrief} />
      )}
    </Suspense>
  );
}

function PanelFallback() {
  return (
    <div className="space-y-3 px-6 py-6" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-3 w-80 max-w-full" />
      <Skeleton className="mt-4 h-48 w-full" />
    </div>
  );
}
