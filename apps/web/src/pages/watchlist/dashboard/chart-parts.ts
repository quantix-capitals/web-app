/**
 * Option fragments shared by the dashboard's charts.
 *
 * Axes, tooltips and the two-colour convention live here so that ten charts
 * agree on what a date looks like, what a rupee looks like, and which colour
 * means "the basket" — the reader learns it once on the first chart and it
 * holds for the rest of the page.
 */

import type Highcharts from "highcharts";
import { formatLevelPercent, formatMoneyCompact, formatPercent } from "@/lib/format";
import { tooltipRows } from "@/components/chart/options";
import type { ChartTheme } from "@/components/chart/theme";

/**
 * Colour follows the entity, everywhere on this page:
 * the basket is slot 1, the index is slot 2, and a third measured line is
 * slot 3. A filter that hides a series never repaints the survivors.
 */
export function basketColor(theme: ChartTheme) {
  return theme.series[0];
}
export function benchmarkColor(theme: ChartTheme) {
  return theme.series[1];
}
export function thirdColor(theme: ChartTheme) {
  return theme.series[2];
}

/** The index is dashed as well as differently coloured — identity twice over. */
export const BENCHMARK_DASH = "ShortDash" as const;

export function dateAxis(dates: number[]): Highcharts.XAxisOptions {
  return {
    type: "datetime",
    // A basket six weeks old and one six years old should not get the same
    // tick density; Highcharts picks the unit, this only bans the noisy ones.
    units: [
      ["day", [1, 7]],
      ["month", [1, 3, 6]],
      ["year", [1, 2, 5]],
    ],
    min: dates[0],
    max: dates[dates.length - 1],
    labels: { format: "{value:%b %e}" },
  };
}

export function moneyAxis(): Highcharts.YAxisOptions {
  return {
    labels: { formatter: axisMoney },
    // Never zero-based: a basket worth ₹4.8L that fell from ₹5L is a 4% move,
    // and forcing the axis to zero flattens it into a straight line.
    startOnTick: false,
    endOnTick: false,
  };
}

function axisMoney(this: Highcharts.AxisLabelsFormatterContextObject): string {
  return formatMoneyCompact(Number(this.value));
}

/**
 * Percent tick labels. Returned as a bare `labels` fragment rather than a whole
 * axis, because the beta scatter needs the same formatting on *both* axes and
 * `XAxisOptions` and `YAxisOptions` are not the same type.
 */
export function percentLabels(options: { signed?: boolean } = {}) {
  return {
    formatter(this: Highcharts.AxisLabelsFormatterContextObject) {
      const value = Number(this.value);
      return options.signed ? formatPercent(value, 0) : formatLevelPercent(value, 0);
    },
  };
}

export function percentAxis(options: { signed?: boolean } = {}): Highcharts.YAxisOptions {
  return { labels: percentLabels(options) };
}

/** A hairline at zero, for every chart whose sign is the point. */
export function zeroLine(theme: ChartTheme): Highcharts.YAxisPlotLinesOptions {
  return { value: 0, color: theme.lineStrong, width: 1, zIndex: 2 };
}

export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * What Highcharts hands a tooltip formatter.
 *
 * Declared here rather than imported: as of Highcharts 12 the formatter's
 * `this` is typed as `Point`, which does not carry the `points` array a *shared*
 * tooltip is given — and shared is what every time series on this page uses. So
 * the shape actually passed is named once, and `tooltipFormatter` below is the
 * only place the cast happens.
 */
export interface TooltipContext {
  x?: number | string | null;
  y?: number | null;
  key?: string | number;
  color?: string;
  index?: number;
  series: { name: string; color?: string; type: string };
  points?: TooltipContext[];
}

export function tooltipFormatter(
  render: (ctx: TooltipContext) => string | false,
): Highcharts.TooltipOptions["formatter"] {
  return function formatter(this: unknown) {
    return render(this as TooltipContext);
  };
}

/** The colour a tooltip row should key with, whichever level Highcharts set it at. */
export function rowColor(point: TooltipContext): string {
  return point.color ?? point.series.color ?? "currentColor";
}

/**
 * The shared crosshair tooltip used by every time series here: the date, then
 * one row per series with its own value, formatted by the caller.
 */
export function dayTooltip(
  format: (value: number, seriesName: string) => string,
): Highcharts.TooltipOptions {
  return {
    formatter: tooltipFormatter((ctx) => {
      const points = ctx.points ?? [];
      if (!points.length) return false;
      return tooltipRows(
        formatDay(Number(points[0].x)),
        points.map((p) => ({
          color: rowColor(p),
          label: p.series.name,
          value: p.y === null || p.y === undefined ? "—" : format(p.y, p.series.name),
        })),
      );
    }),
  };
}

/** Pairs a spine of dates with a value series, dropping nothing. */
export function pair(
  dates: number[],
  values: Array<number | null>,
): Array<[number, number | null]> {
  return dates.map((d, i) => [d, values[i] ?? null]);
}
