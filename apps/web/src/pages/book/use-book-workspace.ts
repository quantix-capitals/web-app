/**
 * The workspace every book of holdings gets: a Dashboard, a Brief and an Analyst
 * tab beside whatever views the page has of its own.
 *
 * A basket and a broker portfolio are the same thing to these three views — a
 * list of symbols with quantities and costs — so the wiring lives here once and
 * both pages call it:
 *
 * - **Which view is open** lives in the URL (`?view=`), so a view can be linked
 *   to, survives a reload and has its own back-button entry. So does the open
 *   analyst run (`?run=`).
 * - **The analyst hook** lives at page level, not inside its tab, so a run keeps
 *   going when the reader flips to another view.
 * - **The sticky chrome** — the page header and the tab strip — is measured and
 *   published as `--basket-chrome`, which the Analyst tab's run list pins
 *   beneath.
 */

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useSearchParams } from "react-router-dom";
import type { TabSpec } from "@/components/ui/primitives";
import { useAnalyst, type UseAnalyst } from "@/lib/analyst/use-analyst";
import type { WatchlistSummary } from "@/lib/watchlist/types";

/** The views every book shares. A page adds its own in front of these. */
export const SHARED_VIEWS = ["dashboard", "brief", "analyst"] as const;
export type SharedView = (typeof SHARED_VIEWS)[number];

export function isSharedView(view: string): view is SharedView {
  return (SHARED_VIEWS as readonly string[]).includes(view);
}

/** The shared tabs, in their fixed order, with the analyst's run count. */
export function bookTabs(analyst: UseAnalyst): Array<TabSpec<SharedView>> {
  return [
    { id: "dashboard", label: "Dashboard" },
    { id: "brief", label: "Brief" },
    {
      id: "analyst",
      label: "Analyst",
      count: analyst.runsStatus === "ready" ? analyst.runs.length : undefined,
    },
  ];
}

export function useBookWorkspace<V extends string>(
  list: WatchlistSummary,
  options: {
    views: readonly V[];
    defaultView: V;
    /** False while the book has no stored record yet. Passed to the analyst. */
    enabled?: boolean;
  },
) {
  const { views, defaultView } = options;
  const [params, setParams] = useSearchParams();
  const view: V = views.find((v) => v === params.get("view")) ?? defaultView;

  const setView = useCallback(
    (next: V) =>
      setParams((prev) => {
        const updated = new URLSearchParams(prev);
        if (next === defaultView) updated.delete("view");
        else updated.set("view", next);
        return updated;
      }),
    [setParams, defaultView],
  );

  const selectRun = useCallback(
    (id: string) =>
      setParams((prev) => {
        const updated = new URLSearchParams(prev);
        updated.set("view", "analyst");
        updated.set("run", id);
        return updated;
      }),
    [setParams],
  );

  const onRunSaved = useCallback(
    (id: string) =>
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev);
          updated.set("run", id);
          return updated;
        },
        { replace: true },
      ),
    [setParams],
  );

  const analyst = useAnalyst(list, {
    active: view === "analyst",
    runParam: params.get("run"),
    onRunSaved,
    enabled: options.enabled,
  });

  // The header and the tab strip stick together as one block whose height
  // changes — a long description wraps, a narrow window stacks the buttons — so
  // its live height is published rather than guessed at in a class name.
  const chromeRef = useRef<HTMLDivElement>(null);
  const [chromeHeight, setChromeHeight] = useState(0);
  useLayoutEffect(() => {
    const node = chromeRef.current;
    if (!node) return;
    const measure = () => setChromeHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const chromeStyle = useMemo(
    () => ({ "--basket-chrome": `${chromeHeight}px` }) as CSSProperties,
    [chromeHeight],
  );

  return { view, setView, analyst, selectRun, chromeRef, chromeStyle };
}
