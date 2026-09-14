/**
 * The two charts a run carries.
 *
 * - **Conviction against the screen**, with the last run's score as a marker:
 *   where the agent departed from the mechanical prior, and where it changed its
 *   mind since last time. Those two gaps are what the chat is for.
 * - **Against the plan**: each holding's return since entry beside the target
 *   and stop its brief set. The brief's pluses and minuses are words; this is
 *   the part of the brief a price can settle.
 *
 * Both use the dashboard's panel, legend and tooltip pieces, so a reader who has
 * learned those charts has learned these.
 */

import { useMemo } from "react";
import type Highcharts from "highcharts";
import { Chart } from "@/components/chart/chart";
import { tooltipRows } from "@/components/chart/options";
import { alpha, useChartTheme } from "@/components/chart/theme";
import { formatPercent } from "@/lib/format";
import type { HoldingReview } from "@/lib/analyst/types";
import { Legend, Panel } from "../dashboard/panel";
import { percentLabels, rowColor, tooltipFormatter, zeroLine } from "../dashboard/chart-parts";

/** A line series drawn as markers only — shared tooltips skip true scatter series. */
function markers(
  name: string,
  color: string,
  symbol: string,
  data: Array<number | null>,
): Highcharts.SeriesOptionsType {
  return {
    type: "line",
    name,
    color,
    data,
    lineWidth: 0,
    marker: { enabled: true, symbol, radius: 5 },
    states: { hover: { lineWidthPlus: 0 } },
  };
}

export function ConvictionChart({ holdings }: { holdings: HoldingReview[] }) {
  const theme = useChartTheme();
  const hasPrevious = holdings.some((h) => h.previous);

  const options = useMemo((): Highcharts.Options => {
    const series: Highcharts.SeriesOptionsType[] = [
      { type: "column", name: "Conviction", color: theme.series[0], data: holdings.map((h) => h.score) },
      { type: "column", name: "Screen", color: theme.series[1], data: holdings.map((h) => h.screen) },
    ];
    if (hasPrevious) {
      series.push(
        markers("Last run", theme.series[2], "diamond", holdings.map((h) => h.previous?.score ?? null)),
      );
    }
    return {
      chart: { spacing: [8, 8, 4, 2] },
      xAxis: {
        categories: holdings.map((h) => h.symbol),
        crosshair: { color: alpha(theme.inkSubtle, 0.1), width: 28 },
        labels: { style: { color: theme.inkMuted, fontSize: "11px" }, rotation: holdings.length > 9 ? -45 : 0 },
      },
      yAxis: { min: 0, max: 100, tickInterval: 25 },
      tooltip: {
        shared: true,
        formatter: tooltipFormatter((ctx) => {
          const points = ctx.points ?? [];
          if (!points.length) return false;
          return tooltipRows(
            String(points[0].key ?? ""),
            points.map((p) => ({
              color: rowColor(p),
              label: p.series.name,
              value: p.y === null || p.y === undefined ? "—" : String(p.y),
            })),
          );
        }),
      },
      series,
    };
  }, [holdings, theme, hasPrevious]);

  const moved = holdings
    .filter((h) => h.previous && h.previous.verdict !== h.verdict)
    .map((h) => h.symbol);

  return (
    <Panel
      title="Conviction against the screen"
      reading="The analyst's score for each holding beside the mechanical screen it was given as a starting point."
      legend={
        <Legend
          items={[
            { label: "Conviction", color: theme.series[0], shape: "block" },
            { label: "Screen", color: theme.series[1], shape: "block" },
            ...(hasPrevious ? [{ label: "Last run", color: theme.series[2], shape: "block" as const }] : []),
          ]}
        />
      }
      note={
        moved.length
          ? `Call changed since the last run it was given: ${moved.join(", ")}.`
          : hasPrevious
            ? "No call changed since the last run it was given."
            : "No earlier run was given as context, so there is nothing to compare against."
      }
    >
      <Chart
        height={240}
        options={options}
        description="Each holding's conviction score beside its screen score, with the previous run's score where there was one."
      />
    </Panel>
  );
}

export function PlanChart({ holdings }: { holdings: HoldingReview[] }) {
  const theme = useChartTheme();
  const rows = holdings.filter((h) => h.signals.sinceEntry !== null || h.plan);
  const hasPlan = rows.some((h) => h.plan && (h.plan.target !== null || h.plan.stop !== null));

  const options = useMemo((): Highcharts.Options => {
    const series: Highcharts.SeriesOptionsType[] = [
      {
        type: "column",
        name: "Since entry",
        data: rows.map((h) => ({
          y: h.signals.sinceEntry,
          color: (h.signals.sinceEntry ?? 0) >= 0 ? theme.gain : theme.loss,
        })),
      },
    ];
    if (hasPlan) {
      series.push(
        markers("Target", theme.gain, "triangle", rows.map((h) => h.plan?.target ?? null)),
        markers("Stop", theme.loss, "triangle-down", rows.map((h) => h.plan?.stop ?? null)),
      );
    }
    return {
      chart: { spacing: [8, 8, 4, 2] },
      xAxis: {
        categories: rows.map((h) => h.symbol),
        crosshair: { color: alpha(theme.inkSubtle, 0.1), width: 28 },
        labels: { style: { color: theme.inkMuted, fontSize: "11px" }, rotation: rows.length > 9 ? -45 : 0 },
      },
      yAxis: { labels: percentLabels({ signed: true }), plotLines: [zeroLine(theme)] },
      tooltip: {
        shared: true,
        formatter: tooltipFormatter((ctx) => {
          const points = ctx.points ?? [];
          if (!points.length) return false;
          return tooltipRows(
            String(points[0].key ?? ""),
            points.map((p) => ({
              color: rowColor(p),
              label: p.series.name,
              value: p.y === null || p.y === undefined ? "—" : formatPercent(p.y, 1),
            })),
          );
        }),
      },
      series,
    };
  }, [rows, theme, hasPlan]);

  if (!rows.some((h) => h.signals.sinceEntry !== null)) {
    return (
      <Panel title="Against the plan">
        <p className="text-detail text-ink-muted">
          No holding has an entry price on record, so there is no return to hold against a target or stop.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Against the plan"
      reading={
        hasPlan
          ? "Return since entry for each holding, with the target and stop its brief set."
          : "Return since entry for each holding. The brief sets no targets or stops to mark against it."
      }
      legend={
        hasPlan ? (
          <Legend
            items={[
              { label: "Target", color: theme.gain, shape: "block" },
              { label: "Stop", color: theme.loss, shape: "block" },
            ]}
          />
        ) : undefined
      }
      note="Entry price is shown, never scored: the analyst's calls do not rest on what was paid."
    >
      <Chart
        height={240}
        options={options}
        description="Each holding's return since entry, with its brief's target and stop where set."
      />
    </Panel>
  );
}
