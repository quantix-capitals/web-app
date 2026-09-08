/**
 * "What did holding this actually feel like, and what is it exposed to?"
 *
 * Return is half a result. These four charts are the other half: how far
 * underwater the basket went, whether its risk is steady or drifting, how much
 * of it is simply the index in disguise, and what a single day can do.
 */

import { useMemo } from "react";
import type Highcharts from "highcharts";
import { Chart } from "@/components/chart/chart";
import { tooltipRows } from "@/components/chart/options";
import { alpha, useChartTheme } from "@/components/chart/theme";
import { formatLevelPercent, formatPercent, formatRatio } from "@/lib/format";
import { BENCHMARK_LABEL, type BasketAnalytics } from "@/lib/analytics/basket";
import { Legend, NotEnough, Panel } from "./panel";
import {
  BENCHMARK_DASH,
  basketColor,
  benchmarkColor,
  dateAxis,
  dayTooltip,
  formatDay,
  pair,
  percentAxis,
  percentLabels,
  thirdColor,
  tooltipFormatter,
  zeroLine,
} from "./chart-parts";

/**
 * The underwater plot: distance below the running high water mark.
 *
 * This is the chart that predicts whether someone will actually hold a basket.
 * A 40% return that spent four months 25% down is a different product from the
 * same 40% earned in a straight line, and only this chart tells them apart.
 */
export function Drawdown({ a }: { a: BasketAnalytics }) {
  const theme = useChartTheme();
  const basket = basketColor(theme);
  const benchmark = benchmarkColor(theme);
  const dd = a.summary.drawdown;

  const options = useMemo(
    () => ({
      xAxis: dateAxis(a.dates),
      yAxis: { ...percentAxis({ signed: true }), max: 0, plotLines: [zeroLine(theme)] },
      tooltip: dayTooltip((v) => (v === 0 ? "At its high" : formatPercent(v))),
      series: [
        {
          type: "area" as const,
          name: "Basket",
          color: basket,
          fillColor: alpha(basket, 0.13),
          threshold: 0,
          data: pair(a.dates, a.drawdown),
          zIndex: 2,
        },
        ...(a.benchmarkAvailable
          ? [
              {
                type: "line" as const,
                name: BENCHMARK_LABEL,
                color: benchmark,
                dashStyle: BENCHMARK_DASH,
                data: pair(a.dates, a.benchmarkDrawdown),
                zIndex: 1,
              },
            ]
          : []),
      ],
    }),
    [a, basket, benchmark, theme],
  );

  const trough = dd ? formatDay(a.dates[dd.troughIndex]) : null;

  return (
    <Panel
      title="Underwater"
      reading="How far below its own high water mark the basket sat on each day. It returns to zero only when a new high is made."
      legend={
        a.benchmarkAvailable ? (
          <Legend
            items={[
              { label: "Basket", color: basket },
              { label: BENCHMARK_LABEL, color: benchmark, shape: "dashed" },
            ]}
          />
        ) : undefined
      }
      note={
        dd
          ? `Deepest fall ${formatPercent(dd.depth)}, reached ${trough}${
              dd.recoveryIndex === null
                ? " — not yet recovered."
                : `, recovered by ${formatDay(a.dates[dd.recoveryIndex])}.`
            }`
          : undefined
      }
    >
      <Chart
        height={200}
        options={options}
        description={`Drawdown from the running peak, deepest ${
          dd ? formatPercent(dd.depth) : "unknown"
        }.`}
      />
    </Panel>
  );
}

/**
 * Rolling volatility — is the risk steady, or is it drifting?
 *
 * A single annualised σ for the whole period hides a basket that was calm for
 * six months and then doubled its volatility. The window is stated on the
 * chart, because a rolling figure without its window is unreadable.
 */
export function RollingVolatility({ a }: { a: BasketAnalytics }) {
  const theme = useChartTheme();
  const basket = basketColor(theme);
  const benchmark = benchmarkColor(theme);
  const window = a.rollingWindowDays;

  const options = useMemo(
    () => ({
      xAxis: dateAxis(a.dates),
      yAxis: { ...percentAxis(), min: 0 },
      tooltip: dayTooltip((v) => `${formatLevelPercent(v)} a year`),
      series: [
        {
          type: "line" as const,
          name: "Basket",
          color: basket,
          data: pair(a.dates, a.rollingVolatility),
          connectNulls: false,
        },
        ...(a.benchmarkAvailable
          ? [
              {
                type: "line" as const,
                name: BENCHMARK_LABEL,
                color: benchmark,
                dashStyle: BENCHMARK_DASH,
                data: pair(a.dates, a.rollingBenchmarkVolatility),
                connectNulls: false,
              },
            ]
          : []),
      ],
    }),
    [a, basket, benchmark],
  );

  if (!window) {
    return (
      <Panel title="Rolling volatility">
        <NotEnough>
          A rolling figure needs at least three months of sessions behind it. Come back when this
          basket has some history.
        </NotEnough>
      </Panel>
    );
  }

  return (
    <Panel
      title={`Rolling volatility (${window} sessions)`}
      reading="Annualised standard deviation of daily returns, recomputed over a moving window. Above the index means the basket is the more turbulent thing to hold, whatever its return."
      legend={
        a.benchmarkAvailable ? (
          <Legend
            items={[
              { label: "Basket", color: basket },
              { label: BENCHMARK_LABEL, color: benchmark, shape: "dashed" },
            ]}
          />
        ) : undefined
      }
      note={`Each point uses the previous ${window} sessions, so the line starts ${window} sessions into the range.`}
    >
      <Chart height={200} options={options} description="Rolling annualised volatility." />
    </Panel>
  );
}

/**
 * Rolling beta and correlation on one axis.
 *
 * They belong together and they share a scale honestly — both are
 * dimensionless and both live around the same range — so this is one axis, not
 * two. Beta says *how hard* the basket moves with the index; correlation says
 * *how reliably*. A high beta with a low correlation is a basket that is
 * volatile for reasons of its own, which is either the thesis or the bug.
 */
export function RollingBeta({ a }: { a: BasketAnalytics }) {
  const theme = useChartTheme();
  const basket = basketColor(theme);
  const third = thirdColor(theme);
  const window = a.rollingWindowDays;

  const options = useMemo(
    () => ({
      xAxis: dateAxis(a.dates),
      yAxis: {
        labels: {
          formatter(this: Highcharts.AxisLabelsFormatterContextObject) {
            return formatRatio(Number(this.value), 1);
          },
        },
        plotLines: [
          zeroLine(theme),
          {
            value: 1,
            color: alpha(theme.inkSubtle, 0.5),
            width: 1,
            dashStyle: "Dot" as const,
            zIndex: 2,
            label: {
              text: "Moves with the index",
              style: { color: theme.inkSubtle, fontSize: "10px" },
              y: -4,
            },
          },
        ],
      },
      tooltip: dayTooltip((v) => formatRatio(v)),
      series: [
        {
          type: "line" as const,
          name: "Beta",
          color: basket,
          data: pair(a.dates, a.rollingBeta),
          connectNulls: false,
        },
        {
          type: "line" as const,
          name: "Correlation",
          color: third,
          data: pair(a.dates, a.rollingCorrelation),
          connectNulls: false,
        },
      ],
    }),
    [a, basket, third, theme],
  );

  if (!window || !a.benchmarkAvailable) return null;

  return (
    <Panel
      title={`Rolling beta and correlation (${window} sessions)`}
      reading={`How much of the basket is ${BENCHMARK_LABEL} in disguise. Beta is the size of the shared move; correlation is how much of the basket that move explains.`}
      legend={
        <Legend
          items={[
            { label: "Beta", color: basket },
            { label: "Correlation", color: third },
          ]}
        />
      }
      note="Both are unitless and sit on the same scale, so they share one axis. A beta that climbs while correlation falls means the basket is getting more volatile without getting more market-driven."
    >
      <Chart height={200} options={options} description="Rolling beta and correlation." />
    </Panel>
  );
}

/**
 * Every day, plotted against the index's same day, with the fitted line.
 *
 * Beta is a slope, and a slope is a picture. This chart shows the number in the
 * stat band being estimated: the tightness of the cloud is the R², the tilt is
 * the beta, and the outlying dots are the days that actually made the year.
 */
export function BetaScatter({ a }: { a: BasketAnalytics }) {
  const theme = useChartTheme();
  const basket = basketColor(theme);
  const fit = a.summary.fit;

  const options = useMemo(() => {
    if (!a.scatter.length || !a.regression) return null;
    const xs = a.scatter.map(([x]) => x);
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    const { slope, intercept } = a.regression;

    return {
      chart: { spacing: [8, 8, 4, 2] },
      xAxis: {
        labels: percentLabels({ signed: true }),
        title: {
          text: `${BENCHMARK_LABEL}, that day`,
          style: { color: theme.inkSubtle, fontSize: "11px" },
        },
        crosshair: false as const,
        gridLineWidth: 1,
        gridLineColor: theme.line,
        plotLines: [{ value: 0, color: theme.lineStrong, width: 1, zIndex: 2 }],
      },
      yAxis: {
        ...percentAxis({ signed: true }),
        plotLines: [zeroLine(theme)],
        title: { text: "Basket, that day", style: { color: theme.inkSubtle, fontSize: "11px" } },
      },
      tooltip: {
        shared: false,
        formatter: tooltipFormatter((ctx) => {
          if (ctx.series.type !== "scatter") return false;
          return tooltipRows("One session", [
            {
              color: benchmarkColor(theme),
              label: BENCHMARK_LABEL,
              value: formatPercent(Number(ctx.x)),
            },
            { color: basket, label: "Basket", value: formatPercent(Number(ctx.y)) },
          ]);
        }),
      },
      series: [
        {
          type: "scatter" as const,
          name: "Sessions",
          color: alpha(basket, 0.5),
          data: a.scatter,
          marker: { radius: 3 },
        },
        {
          type: "line" as const,
          name: "Fitted",
          color: theme.inkSubtle,
          dashStyle: "Dash" as const,
          enableMouseTracking: false,
          data: [
            [min, intercept + slope * min],
            [max, intercept + slope * max],
          ],
          marker: { enabled: false },
        },
      ],
    };
  }, [a, basket, theme]);

  if (!options || !fit) return null;

  return (
    <Panel
      title="Every session against the index"
      reading="One dot per trading day. The tilt of the fitted line is the beta; how tightly the cloud hugs it is how much of the basket the index explains."
      legend={
        <Legend
          items={[
            { label: "Sessions", color: alpha(basket, 0.6), shape: "block" },
            { label: "Fitted line", color: theme.inkSubtle, shape: "dashed" },
          ]}
        />
      }
      note={`Slope (beta) ${formatRatio(fit.beta)} · R² ${formatRatio(fit.rSquared)} — the index explains ${formatLevelPercent(fit.rSquared, 0)} of the basket's day-to-day movement, over ${fit.observations} sessions.`}
    >
      <Chart
        height={260}
        options={options}
        description={`Scatter of daily basket returns against ${BENCHMARK_LABEL}, beta ${formatRatio(
          fit.beta,
        )}.`}
      />
    </Panel>
  );
}
