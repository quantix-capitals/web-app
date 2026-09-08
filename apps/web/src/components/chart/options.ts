/**
 * The house style, and the tooltip markup that goes with it.
 *
 * These are not per-chart taste; they are applied once here so no caller can
 * drift from them.
 *
 * - **No chrome.** No border, no background, no shadow, no Highcharts credit.
 *   A chart on this product is a region of the page, like a table, not a card
 *   floating on it.
 * - **Recessive grid.** Hairline, solid, one step off the surface — never
 *   dashed, never competing with the data. No vertical gridlines at all.
 * - **2px lines, no markers until hover.** A marker on every daily close is a
 *   thousand dots nobody asked for; the crosshair finds the date instead.
 * - **One shared tooltip, values leading.** Every series at that x, listed with
 *   a short stroke of its own colour as the key, the number set strong and the
 *   name secondary.
 * - **Text wears text tokens.** Axis labels, legends and tooltips are ink; only
 *   the marks carry a series colour.
 *
 * ## Colour
 *
 * The three categorical slots in `theme.ts` were validated with the data-viz
 * palette checker against this app's own surfaces (`#fafaf7` light, `#121418`
 * dark): all checks pass in both modes, worst adjacent CVD ΔE 24.7 / 26.0.
 *
 * `gain` and `loss` are a red/green polarity pair and do *not* pass a
 * categorical CVD check — nothing on this dashboard asks them to. Wherever they
 * appear, position against the zero baseline and a signed value carry the
 * meaning, and colour only reinforces it.
 */

import type Highcharts from "highcharts";
import type { ChartTheme } from "./theme";

/** Merged under the caller's options, so any chart can override any of it. */
export function baseOptions(theme: ChartTheme): Highcharts.Options {
  const font = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim();

  return {
    credits: { enabled: false },
    accessibility: { enabled: false },
    title: { text: undefined },
    chart: {
      backgroundColor: "transparent",
      spacing: [8, 2, 4, 2],
      style: { fontFamily: font || "system-ui, sans-serif" },
      animation: { duration: 260 },
    },
    colors: [...theme.series],
    xAxis: {
      lineColor: theme.line,
      tickColor: theme.line,
      // Vertical gridlines on a time series add a second grid to read past;
      // the crosshair does that job on demand instead.
      gridLineWidth: 0,
      crosshair: { width: 1, color: theme.lineStrong, dashStyle: "Solid" },
      labels: { style: { color: theme.inkSubtle, fontSize: "11px" } },
      tickLength: 4,
    },
    yAxis: {
      title: { text: undefined },
      gridLineColor: theme.line,
      gridLineWidth: 1,
      lineWidth: 0,
      labels: { style: { color: theme.inkSubtle, fontSize: "11px" } },
    },
    legend: {
      enabled: false,
      align: "left",
      verticalAlign: "top",
      margin: 14,
      itemStyle: { color: theme.inkMuted, fontWeight: "500", fontSize: "12px" },
      itemHoverStyle: { color: theme.ink },
      itemHiddenStyle: { color: theme.inkSubtle },
      symbolHeight: 2,
      symbolWidth: 14,
      symbolRadius: 1,
      squareSymbol: false,
    },
    tooltip: {
      shared: true,
      shadow: false,
      borderWidth: 1,
      borderRadius: 6,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      style: { color: theme.ink, fontSize: "12px" },
      // The pointer only has to be closest, not on the line.
      snap: 24,
      padding: 10,
      useHTML: true,
    },
    plotOptions: {
      series: {
        animation: { duration: 260 },
        states: { inactive: { opacity: 0.32 }, hover: { halo: { size: 0 } } },
      },
      line: {
        lineWidth: 2,
        marker: { enabled: false, radius: 4, symbol: "circle", states: { hover: { radiusPlus: 1, lineWidth: 2, lineColor: theme.surface } } },
      },
      area: {
        lineWidth: 2,
        fillOpacity: 0.12,
        marker: { enabled: false, radius: 4, symbol: "circle" },
      },
      areaspline: { lineWidth: 2, fillOpacity: 0.12, marker: { enabled: false } },
      column: {
        borderWidth: 0,
        // 4px rounded data-end, square at the baseline.
        borderRadius: 2,
        maxPointWidth: 24,
        groupPadding: 0.12,
        pointPadding: 0.04,
      },
      scatter: {
        marker: { radius: 3, symbol: "circle", states: { hover: { radiusPlus: 2 } } },
      },
    },
  };
}

// --- tooltip helpers ------------------------------------------------------------

/**
 * The shared-tooltip body: a heading, then one row per series with a short
 * stroke of its colour, the name secondary and the value strong.
 *
 * Everything interpolated here is either a number this app computed or a symbol
 * from the instruments table, but the symbol still goes through `escape` — a
 * ticker is user-supplied data, and a tooltip built by string concatenation is
 * exactly where that stops being harmless.
 */
export function tooltipRows(
  heading: string,
  rows: Array<{ color: string; label: string; value: string; muted?: boolean }>,
): string {
  const body = rows
    .map(
      (row) =>
        `<div style="display:flex;align-items:center;gap:8px;margin-top:4px">` +
        `<span style="display:inline-block;width:12px;height:2px;border-radius:1px;background:${escape(row.color)}"></span>` +
        `<span style="flex:1;opacity:${row.muted ? 0.6 : 0.75}">${escape(row.label)}</span>` +
        `<b style="font-variant-numeric:tabular-nums">${escape(row.value)}</b>` +
        `</div>`,
    )
    .join("");

  return (
    `<div style="min-width:150px"><div style="opacity:0.6;font-size:11px">${escape(heading)}</div>${body}</div>`
  );
}

export function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
