/**
 * "What is this basket actually made of?"
 *
 * The three questions a group of picks raises that no individual chart can
 * answer: where the money went, where the *risk* went (rarely the same place),
 * and whether the names are different bets or one bet held several times.
 */

import { useMemo } from "react";
import type Highcharts from "highcharts";
import { Chart } from "@/components/chart/chart";
import { tooltipRows } from "@/components/chart/options";
import { alpha, useChartTheme } from "@/components/chart/theme";
import { cn, formatLevelPercent, formatMoney, formatMoneyCompact, formatPercent, formatRatio } from "@/lib/format";
import { type BasketAnalytics } from "@/lib/analytics/basket";
import { Legend, Metric, NotEnough, Panel } from "./panel";
import {
  basketColor,
  benchmarkColor,
  percentAxis,
  rowColor,
  tooltipFormatter,
  zeroLine,
} from "./chart-parts";

/**
 * Weight of money against share of risk.
 *
 * The single most useful chart on this page for a *group*. The two bars for a
 * holding are equal only when every name is equally volatile and equally
 * correlated with the rest, which is never. A name whose orange bar towers over
 * its blue one is running the basket without owning much of it.
 */
export function WeightVsRisk({ a }: { a: BasketAnalytics }) {
  const theme = useChartTheme();
  const money = basketColor(theme);
  const risk = benchmarkColor(theme);

  const rows = useMemo(
    () => [...a.holdings].sort((x, y) => y.weight - x.weight),
    [a.holdings],
  );

  const options = useMemo(
    () => ({
      chart: { spacing: [8, 8, 4, 2] },
      xAxis: {
        categories: rows.map((h) => h.symbol),
        crosshair: { color: alpha(theme.inkSubtle, 0.1), width: 28 },
        labels: { style: { color: theme.inkMuted, fontSize: "11px" }, rotation: rows.length > 9 ? -45 : 0 },
      },
      yAxis: { ...percentAxis(), min: 0 },
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
              value: formatLevelPercent(Number(p.y)),
            })),
          );
        }),
      },
      series: [
        {
          type: "column" as const,
          name: "Share of money",
          color: money,
          data: rows.map((h) => h.weight),
        },
        {
          type: "column" as const,
          name: "Share of risk",
          color: risk,
          data: rows.map((h) => h.riskShare),
        },
      ],
    }),
    [rows, money, risk, theme],
  );

  if (!a.risk) {
    return (
      <Panel title="Money against risk">
        <NotEnough>
          Splitting the basket&apos;s volatility across its holdings needs at least twenty sessions
          in which every holding traded. This basket has {a.risk ? "" : "fewer"} than that so far.
        </NotEnough>
      </Panel>
    );
  }

  const worst = [...a.holdings]
    .filter((h) => h.riskShare !== null)
    .sort((x, y) => y.riskShare! - y.weight - (x.riskShare! - x.weight))[0];

  return (
    <Panel
      title="Money against risk"
      reading="What each holding is worth as a share of the basket, beside how much of the basket's volatility it accounts for. They match only by accident."
      legend={
        <Legend
          items={[
            { label: "Share of money", color: money, shape: "block" },
            { label: "Share of risk", color: risk, shape: "block" },
          ]}
        />
      }
      note={
        worst && worst.riskShare !== null && worst.riskShare - worst.weight > 0.03
          ? `${worst.symbol} is ${formatLevelPercent(worst.weight)} of the money and ${formatLevelPercent(worst.riskShare)} of the risk — it is a larger position than it looks. Risk shares are marginal contributions to variance and sum to 100%.`
          : "Risk shares are marginal contributions to variance — each holding's own volatility and its correlation with the rest — and sum to 100%."
      }
    >
      <Chart
        height={240}
        options={options}
        description="Each holding's share of the basket's value beside its share of the basket's risk."
      />
    </Panel>
  );
}

/**
 * Who actually made the money.
 *
 * In rupees, not percentages: a 60% gain on a token position is a nice
 * screenshot and contributed nothing. The bars here sum exactly to the
 * basket's P&L for the range, which is the check that this chart and the stat
 * band above are describing the same basket.
 */
export function Contribution({ a }: { a: BasketAnalytics }) {
  const theme = useChartTheme();
  const rows = useMemo(
    () => [...a.holdings].sort((x, y) => y.contribution - x.contribution),
    [a.holdings],
  );

  const options = useMemo(
    () => ({
      chart: { spacing: [8, 8, 4, 2] },
      xAxis: {
        categories: rows.map((h) => h.symbol),
        crosshair: { color: alpha(theme.inkSubtle, 0.1), width: 28 },
        labels: { style: { color: theme.inkMuted, fontSize: "11px" }, rotation: rows.length > 9 ? -45 : 0 },
      },
      yAxis: {
        labels: {
          formatter(this: Highcharts.AxisLabelsFormatterContextObject) {
            return formatMoneyCompact(Number(this.value), true);
          },
        },
        plotLines: [zeroLine(theme)],
      },
      tooltip: {
        shared: false,
        formatter: tooltipFormatter((ctx) => {
          const row = rows[ctx.index ?? -1];
          if (!row) return false;
          return tooltipRows(row.symbol, [
            {
              color: row.contribution >= 0 ? theme.gain : theme.loss,
              label: "Contributed",
              value: formatMoney(row.contribution, true),
            },
            {
              color: theme.inkSubtle,
              label: "Own return",
              value: row.returnPct === null ? "—" : formatPercent(row.returnPct),
              muted: true,
            },
            {
              color: theme.inkSubtle,
              label: "Weight",
              value: formatLevelPercent(row.weight),
              muted: true,
            },
          ]);
        }),
      },
      series: [
        {
          type: "column" as const,
          name: "Contribution",
          data: rows.map((h) => ({
            y: h.contribution,
            // Sign is carried by which side of the baseline the bar is on and
            // by the signed value in the tooltip; colour only reinforces it.
            color: h.contribution >= 0 ? theme.gain : theme.loss,
          })),
        },
      ],
    }),
    [rows, theme],
  );

  const winners = rows.filter((h) => h.contribution > 0);
  const topTwo = winners.slice(0, 2).reduce((acc, h) => acc + h.contribution, 0);
  const totalWon = winners.reduce((acc, h) => acc + h.contribution, 0);

  return (
    <Panel
      title="Who made the money"
      reading="Each holding's contribution to the basket's profit, in rupees. A big percentage on a small position lands here as the small number it really is."
      note={
        totalWon > 0 && winners.length > 2
          ? `The top two winners are ${formatLevelPercent(topTwo / totalWon, 0)} of everything the winners made. The bars sum to the basket's gain for this range.`
          : "The bars sum to the basket's gain for this range."
      }
    >
      <Chart
        height={240}
        options={options}
        description="Contribution to profit by holding, in rupees."
      />
    </Panel>
  );
}

/**
 * The diversification read, as four figures and a matrix.
 *
 * Every one of these answers the same question a different way: is this twelve
 * bets or one bet twelve times? They are grouped rather than scattered through
 * the stat band because they only mean anything read together.
 */
export function Diversification({ a }: { a: BasketAnalytics }) {
  const risk = a.risk;
  const conc = a.concentration;

  if (!conc) return null;

  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-8 border-b border-line px-6 py-1.5 sm:grid-cols-4">
        <Metric
          label="Effective holdings"
          value={formatRatio(conc.effectiveHoldings, 1)}
          hint={`of ${a.holdings.length} actual`}
          title="1 / Herfindahl index. How many equally-sized positions this basket behaves like."
          tone={conc.effectiveHoldings < a.holdings.length / 2 ? "warn" : "neutral"}
        />
        <Metric
          label="Top three weight"
          value={formatLevelPercent(conc.topThreeWeight)}
          hint={`largest ${formatLevelPercent(conc.largestWeight)}`}
          title="Share of the basket's value held in its three largest positions."
        />
        <Metric
          label="Average correlation"
          value={
            risk?.averageCorrelation === null || risk === null
              ? "—"
              : formatRatio(risk.averageCorrelation)
          }
          hint="between holdings"
          title="Mean pairwise correlation of daily returns. Above ~0.7 the names move as one."
          tone={risk?.averageCorrelation && risk.averageCorrelation > 0.7 ? "warn" : "neutral"}
        />
        <Metric
          label="Diversification ratio"
          value={risk ? formatRatio(risk.diversificationRatio) : "—"}
          hint={
            risk
              ? `${formatLevelPercent(risk.weightedAverageVolatility)} → ${formatLevelPercent(
                  risk.portfolioVolatility,
                )}`
              : undefined
          }
          title="Weighted average volatility of the holdings divided by the basket's own. 1.00 means the names gave back nothing by being held together."
          tone={risk && risk.diversificationRatio < 1.15 ? "warn" : "neutral"}
        />
      </dl>

      {a.correlations ? (
        <CorrelationMatrix
          symbols={a.correlations.symbols}
          matrix={a.correlations.matrix}
          observations={a.correlations.observations}
        />
      ) : null}
    </div>
  );
}

/**
 * The correlation matrix, as a real table rather than a chart.
 *
 * Deliberate: a matrix is already a grid of labelled cells, so an HTML table is
 * the honest markup for it — it reads to a screen reader, it inherits the
 * product's type and rules, and it is the table view for this section rather
 * than needing one alongside. The tint is the diverging pair around zero, and
 * the number is printed in every cell, so colour is never the only channel.
 */
function CorrelationMatrix({
  symbols,
  matrix,
  observations,
}: {
  symbols: string[];
  matrix: number[][];
  observations: number;
}) {
  return (
    <Panel
      title="How alike the holdings are"
      reading="Correlation of daily returns between every pair. Deep red is a pair that moves as one; pale or blue is a pair that genuinely diversifies."
      note={`Over the ${observations} sessions in which every holding traded. A basket of highly correlated names is one position with extra brokerage.`}
    >
      <div className="overflow-x-auto">
        <table className="border-collapse text-meta tabular-nums">
          <caption className="sr-only">
            Pairwise correlation of daily returns between the basket&apos;s holdings
          </caption>
          <thead>
            <tr>
              <th className="sticky left-0 z-1 bg-canvas p-1.5" />
              {symbols.map((s) => (
                <th
                  key={s}
                  scope="col"
                  className="p-1.5 text-left font-mono font-medium whitespace-nowrap text-ink-muted"
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((row, i) => (
              <tr key={row}>
                <th
                  scope="row"
                  className="sticky left-0 z-1 bg-canvas p-1.5 pr-3 text-left font-mono font-medium whitespace-nowrap text-ink-muted"
                >
                  {row}
                </th>
                {symbols.map((col, j) => (
                  <Cell key={col} value={matrix[i][j]} self={i === j} label={`${row} and ${col}`} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Cell({ value, self, label }: { value: number; self: boolean; label: string }) {
  // Diverging around zero: warm for "moves together", cool for "moves apart",
  // and the surface itself as the neutral midpoint. The intensity is the
  // magnitude; the printed number is the fact.
  const tint = self
    ? "var(--color-sunken)"
    : value >= 0
      ? `color-mix(in srgb, var(--color-loss) ${Math.round(Math.abs(value) * 42)}%, var(--color-surface))`
      : `color-mix(in srgb, var(--color-info) ${Math.round(Math.abs(value) * 42)}%, var(--color-surface))`;

  return (
    <td
      className={cn(
        "border border-canvas p-1.5 text-center whitespace-nowrap",
        self ? "text-ink-subtle" : "text-ink",
      )}
      style={{ background: tint }}
      title={`${label}: ${formatRatio(value)}`}
    >
      {self ? "—" : formatRatio(value)}
    </td>
  );
}
