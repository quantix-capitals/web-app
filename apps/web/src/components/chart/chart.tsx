/**
 * The one place Highcharts is touched.
 *
 * A hand-rolled wrapper rather than `highcharts-react-official`: the official
 * binding is a hundred lines that recreate a chart on every prop change, and
 * this needs the opposite — a chart that is created once and *updated*, so
 * switching a range animates the series instead of tearing the SVG down and
 * building it again.
 *
 * The house style every chart inherits lives next door in `options.ts`; this
 * file is only the React binding for it.
 */

import { useEffect, useRef } from "react";
import Highcharts from "highcharts";
import { cn } from "@/lib/format";
import { useChartTheme } from "./theme";
import { baseOptions } from "./options";

export function Chart({
  options,
  height,
  className,
  /** Reads to a screen reader in place of the SVG, which is aria-hidden. */
  description,
}: {
  options: Highcharts.Options;
  height: number;
  className?: string;
  description: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<Highcharts.Chart | null>(null);
  const theme = useChartTheme();

  useEffect(() => {
    if (!host.current) return;
    const merged = Highcharts.merge(baseOptions(theme), { chart: { height } }, options);

    if (!chart.current) {
      chart.current = Highcharts.chart(host.current, merged);
    } else {
      // `true, true` — redraw, and treat this as a full replacement so a series
      // that disappeared from the options disappears from the chart too.
      chart.current.update(merged, true, true);
    }
    // `options` is rebuilt on every render by its caller; the deep-compare
    // Highcharts does inside `update` is cheaper than memoising it upstream.
  }, [options, theme, height]);

  useEffect(() => {
    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
  }, []);

  return (
    // `relative` is load-bearing, not cosmetic. `sr-only` is `position:absolute`,
    // and an absolutely-positioned box with no positioned ancestor resolves
    // against the viewport — which means it escapes the app shell's
    // `overflow:hidden` and stretches the *document* to the full height of the
    // page it sits on. Ten charts on the dashboard did exactly that and gave the
    // view a second scrollbar alongside the shell's own. This makes the wrapper
    // the containing block, so the span stays inside the scroller.
    <div className={cn("relative w-full", className)}>
      <div ref={host} aria-hidden style={{ height }} />
      <span className="sr-only">{description}</span>
    </div>
  );
}
