/**
 * "Did this basket make money, and was picking it worth the trouble?"
 *
 * Four charts, in the order the question is actually asked: the money itself,
 * the money against the index, the gap between them, and the month-by-month
 * record behind that gap.
 */

import { useMemo } from "react";
import type Highcharts from "highcharts";
import { Chart } from "@/components/chart/chart";
import { tooltipRows } from "@/components/chart/options";
import { alpha, useChartTheme } from "@/components/chart/theme";
import { formatMoney, formatMoneyCompact, formatPercent } from "@/lib/format";
import { BENCHMARK_LABEL, type BasketAnalytics } from "@/lib/analytics/basket";
import { Legend, NotEnough, Panel } from "./panel";
import {
  BENCHMARK_DASH,
  basketColor,
  benchmarkColor,
  dateAxis,
  dayTooltip,
  formatDay,
  moneyAxis,
  pair,
  percentAxis,
  rowColor,
  tooltipFormatter,
  zeroLine,
} from "./chart-parts";

export function EquityCurve({ a }: { a: BasketAnalytics }) {
  const theme = useChartTheme();
  const basket = basketColor(theme);
  const benchmark = benchmarkColor(theme);

  const options = useMemo(
    () => ({
      xAxis: dateAxis(a.dates),
      // The cost line only means something on a window that opens at entry. On
      // a 3M view the basket's cost is off-screen history, and drawing it would
      // invite reading a quarter's move against a year-old outlay.
      yAxis: {
        ...moneyAxis(),
        plotLines:
          a.summary.openingValue === a.summary.invested
            ? [{ value: a.summary.invested, color: theme.lineStrong, width: 1, dashStyle: "Dot" as const, zIndex: 2, label: { text: "Invested", style: { color: theme.inkSubtle, fontSize: "10px" }, align: "right" as const, x: -4, y: -4 } }]
            : [],
      },
      tooltip: dayTooltip((v) => formatMoney(v)),
      series: [
        {
          type: "area" as const,
          name: "Basket",
          color: basket,
          fillColor: alpha(basket, 0.1),
          data: pair(a.dates, a.value),
          zIndex: 2,
        },
        ...(a.benchmarkAvailable
          ? [
              {
                type: "line" as const,
                name: BENCHMARK_LABEL,
                color: benchmark,
                dashStyle: BENCHMARK_DASH,
                data: pair(a.dates, a.benchmarkValue),
                zIndex: 1,
              },
            ]
          : []),
      ],
    }),
    [a, basket, benchmark, theme],
  );

  return (
    <Panel
      title="Value of the basket"
      reading={
        a.benchmarkAvailable
          ? `The rupees actually committed, against what the same rupees would be worth in ${BENCHMARK_LABEL} — bought on the same days, in the same amounts.`
          : "The rupees actually committed, valued at each day's close."
      }
      legend={
        a.benchmarkAvailable ? (
          <Legend
            items={[
              { label: "Basket", color: basket },
              { label: `Same money in ${BENCHMARK_LABEL}`, color: benchmark, shape: "dashed" },
            ]}
          />
        ) : undefined
      }
      note="Split- and dividend-adjusted closes, anchored to each holding's recorded entry price. A holding is held at cost before the day it was added, so the invested total never jumps."
    >
      <Chart
        height={320}
        options={options}
        description={`Basket value from ${formatDay(a.dates[0])} to ${formatDay(
          a.dates[a.dates.length - 1],
        )}, ending at ${formatMoney(a.summary.marketValue)}.`}
      />
    </Panel>
  );
}

/**
 * The gap, plotted on its own.
 *
 * Two lines a few percent apart on the chart above are hard to read as a
 * difference — the eye measures vertical distance badly. Subtracting them and
 * plotting the result against zero turns "which is higher" into "which side of
 * the line", which is a question the eye answers instantly.
 */
export function ExcessReturn({ a }: { a: BasketAnalytics }) {
  const theme = useChartTheme();

  const options = useMemo(
    () => ({
      xAxis: dateAxis(a.dates),
      yAxis: { ...percentAxis({ signed: true }), plotLines: [zeroLine(theme)] },
      tooltip: {
        formatter: tooltipFormatter((ctx) => {
          const point = ctx.points?.[0] ?? ctx;
          if (point.y === null || point.y === undefined) return false;
          const value = Number(point.y);
          return tooltipRows(formatDay(Number(point.x)), [
            {
              color: value >= 0 ? theme.gain : theme.loss,
              label: value >= 0 ? "Ahead of the index" : "Behind the index",
              value: formatPercent(Math.abs(value)).replace("+", ""),
            },
          ]);
        }),
      },
      series: [
        {
          type: "area" as const,
          name: "Excess return",
          data: pair(a.dates, a.excess),
          // Polarity, encoded three ways: which side of the baseline the fill
          // sits on, the sign in the tooltip, and only then colour.
          zones: [
            { value: 0, color: theme.loss, fillColor: alpha(theme.loss, 0.14) },
            { color: theme.gain, fillColor: alpha(theme.gain, 0.14) },
          ],
          threshold: 0,
        },
      ],
    }),
    [a, theme],
  );

  if (!a.benchmarkAvailable) {
    return (
      <Panel title="Ahead of or behind the index">
        <NotEnough>
          {BENCHMARK_LABEL} history was not available for this period, so there is nothing to
          measure the basket against.
        </NotEnough>
      </Panel>
    );
  }

  const last = a.excess[a.excess.length - 1];

  return (
    <Panel
      title="Ahead of or behind the index"
      reading={`Cumulative basket return minus ${BENCHMARK_LABEL}'s, from the start of the range. Above the line is outperformance; the distance is the whole of it.`}
      note={
        a.summary.fit
          ? `Ends ${formatPercent(last ?? 0)}. Tracking error ${formatPercent(
              a.summary.fit.trackingError,
            ).replace("+", "")} a year — how far this line typically wanders.`
          : undefined
      }
    >
      <Chart
        height={220}
        options={options}
        description={`Cumulative excess return over ${BENCHMARK_LABEL}, ending at ${formatPercent(
          last ?? 0,
        )}.`}
      />
    </Panel>
  );
}

/**
 * Turnover — the constituents' own traded value, summed.
 *
 * It gets its own panel rather than a second axis under the equity curve. A
 * chart with two y-scales invites the reader to compare two lines that share no
 * units, and the comparison is always meaningless; stacked panes on a shared
 * date axis say the same thing honestly.
 */
export function Turnover({ a }: { a: BasketAnalytics }) {
  const theme = useChartTheme();
  const printed = a.turnover.filter((v): v is number => v !== null);

  const options = useMemo(
    () => ({
      xAxis: dateAxis(a.dates),
      yAxis: {
        labels: {
          formatter(this: Highcharts.AxisLabelsFormatterContextObject) {
            return formatMoneyCompact(Number(this.value));
          },
        },
        min: 0,
      },
      tooltip: dayTooltip((v) => formatMoneyCompact(v)),
      series: [
        {
          type: "column" as const,
          name: "Traded value",
          color: alpha(basketColor(theme), 0.55),
          data: pair(a.dates, a.turnover),
        },
      ],
    }),
    [a, theme],
  );

  if (printed.length < 5) {
    return null;
  }

  const median = [...printed].sort((x, y) => x - y)[Math.floor(printed.length / 2)];

  return (
    <Panel
      title="Liquidity of the holdings"
      reading="Traded value across the basket's constituents each session — close × volume, summed. Not the basket's own turnover: it is how easily this set of names could be got into or out of."
      note={`Median session ${formatMoneyCompact(median)} across ${a.holdings.length} ${
        a.holdings.length === 1 ? "holding" : "holdings"
      }. A sustained fall here is a liquidity warning that no price chart shows.`}
    >
      <Chart
        height={160}
        options={options}
        description={`Daily traded value across the basket's holdings, median ${formatMoneyCompact(
          median,
        )}.`}
      />
    </Panel>
  );
}

/** Month by month, basket against index — where the excess line was actually earned. */
export function MonthlyReturns({ a }: { a: BasketAnalytics }) {
  const theme = useChartTheme();
  const basket = basketColor(theme);
  const benchmark = benchmarkColor(theme);

  const options = useMemo(
    () => ({
      xAxis: {
        categories: a.monthly.map((m) => m.label),
        crosshair: { color: alpha(theme.inkSubtle, 0.12), width: 24 },
      },
      yAxis: { ...percentAxis({ signed: true }), plotLines: [zeroLine(theme)] },
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
              value: formatPercent(Number(p.y)),
            })),
          );
        }),
      },
      series: [
        { type: "column" as const, name: "Basket", color: basket, data: a.monthly.map((m) => m.basket) },
        ...(a.benchmarkAvailable
          ? [
              {
                type: "column" as const,
                name: BENCHMARK_LABEL,
                color: benchmark,
                data: a.monthly.map((m) => m.benchmark),
              },
            ]
          : []),
      ],
    }),
    [a, basket, benchmark, theme],
  );

  if (a.monthly.length < 2) return null;

  const won = a.monthly.filter((m) => m.benchmark !== null && m.basket > m.benchmark).length;
  const comparable = a.monthly.filter((m) => m.benchmark !== null).length;

  return (
    <Panel
      title="Month by month"
      reading="Where the gap was earned or given back. One good month can carry a whole cumulative line, and this is the chart that shows whether that is what happened."
      legend={
        a.benchmarkAvailable ? (
          <Legend
            items={[
              { label: "Basket", color: basket, shape: "block" },
              { label: BENCHMARK_LABEL, color: benchmark, shape: "block" },
            ]}
          />
        ) : undefined
      }
      note={
        comparable
          ? `Beat ${BENCHMARK_LABEL} in ${won} of ${comparable} ${
              comparable === 1 ? "month" : "months"
            }. A basket that wins most months but loses the year is one big month behind.`
          : undefined
      }
    >
      <Chart
        height={220}
        options={options}
        description={`Monthly returns for the basket and ${BENCHMARK_LABEL} across ${a.monthly.length} months.`}
      />
    </Panel>
  );
}
