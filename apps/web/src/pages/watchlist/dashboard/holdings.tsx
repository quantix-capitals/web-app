/**
 * The individual holdings — as small multiples, then as a table.
 *
 * A single chart with fifteen lines on it is the classic way to make a basket
 * illegible: no categorical palette survives past eight series, the lines cross
 * constantly, and the reader ends up hunting the legend for a colour instead of
 * reading anything. Small multiples solve it properly — one tiny panel per
 * holding, all on the same rebased scale, sorted by contribution, so the
 * comparison is made by *position on the page* rather than by hue.
 *
 * The sparklines are hand-drawn SVG rather than fifteen Highcharts instances:
 * at this size a chart engine's axes, tooltips and event handlers are all
 * overhead for a shape, and fifteen live charts is a visible cost on a page
 * that already has eight.
 */

import { HeadRow, Sub, Table, Td, Th, Tr } from "@/components/ui/table";
import { SymbolLink } from "@/components/ui/primitives";
import { useChartTheme } from "@/components/chart/theme";
import {
  cn,
  formatLevelPercent,
  formatMoney,
  formatPercent,
  formatRatio,
  moveTone,
} from "@/lib/format";
import { BENCHMARK_LABEL, type BasketAnalytics, type HoldingStat } from "@/lib/analytics/basket";
import { Panel } from "./panel";

export function HoldingSparklines({ a }: { a: BasketAnalytics }) {
  const rows = [...a.holdings].sort((x, y) => (y.returnPct ?? -Infinity) - (x.returnPct ?? -Infinity));

  return (
    <Panel
      title="Every holding, on one scale"
      reading="Each line is rebased to 100 at the start of the range, so a ₹50 stock and a ₹5,000 stock are directly comparable. Sorted best to worst."
      note="A holding added part-way through the range starts flat at its entry cost — the flat run is the time before it was in the basket, not a stock that did not move."
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {rows.map((h) => (
          <Sparkline key={h.id} holding={h} />
        ))}
      </div>
    </Panel>
  );
}

const SPARK_W = 160;
const SPARK_H = 44;

function Sparkline({ holding }: { holding: HoldingStat }) {
  const theme = useChartTheme();
  const up = (holding.returnPct ?? 0) >= 0;
  const stroke = up ? theme.gain : theme.loss;

  const values = holding.indexed;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * SPARK_W;
  const y = (v: number) => SPARK_H - ((v - min) / span) * SPARK_H;

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${SPARK_W} ${SPARK_H} L0 ${SPARK_H} Z`;
  // The 100 line is the only reference a rebased sparkline needs: above it the
  // holding is up on the range, below it is down.
  const baseline = 100 >= min && 100 <= max ? y(100) : null;

  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-2">
        <SymbolLink
          symbol={holding.symbol}
          exchange={holding.exchange}
          className="truncate font-mono text-meta font-medium text-ink"
        />
        {/* The figure is the label; the sign and the number carry the meaning,
            and the line's colour only agrees with them. */}
        <span
          className={cn(
            "shrink-0 text-meta font-medium tabular-nums",
            up ? "text-gain" : "text-loss",
          )}
        >
          {holding.returnPct === null ? "—" : formatPercent(holding.returnPct)}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        preserveAspectRatio="none"
        className="mt-1.5 h-11 w-full"
        role="img"
        aria-label={`${holding.symbol}, ${
          holding.returnPct === null ? "no return" : formatPercent(holding.returnPct)
        } over the range`}
      >
        {baseline !== null ? (
          <line
            x1="0"
            y1={baseline}
            x2={SPARK_W}
            y2={baseline}
            stroke={theme.line}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <path d={area} fill={stroke} opacity="0.1" />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </figure>
  );
}

/**
 * The table view.
 *
 * Every figure plotted anywhere above is readable here as a number, which is
 * what makes the charts an aid rather than a gate — and it is the only place
 * the per-holding beta and drawdown appear at all.
 */
export function HoldingsTable({ a }: { a: BasketAnalytics }) {
  const rows = [...a.holdings].sort((x, y) => y.contribution - x.contribution);

  return (
    <Panel
      title="Holdings, in figures"
      reading="Everything the charts above show, as numbers. Sorted by what each name put into the basket's profit."
      note={`Beta and correlation are measured against ${BENCHMARK_LABEL} and the basket respectively, over the sessions in the selected range. “Risk” is the holding's share of the basket's variance.`}
    >
      <div className="-mx-6">
        <Table minWidth="min-w-230">
          <HeadRow>
            <Th align="left" first grow>
              Symbol
            </Th>
            <Th tight>Weight</Th>
            <Th tight>Risk</Th>
            <Th tight>Return</Th>
            <Th tight>Contributed</Th>
            <Th tight>Volatility</Th>
            <Th tight>Beta</Th>
            <Th tight>Max fall</Th>
            <Th last tight>
              Corr. to basket
            </Th>
          </HeadRow>
          <tbody>
            {rows.map((h) => (
              <Tr key={h.id}>
                <Td align="left" first grow>
                  <div className="flex items-center gap-2">
                    <SymbolLink
                      symbol={h.symbol}
                      exchange={h.exchange}
                      className="font-mono font-medium text-ink"
                    />
                    {h.partial ? (
                      <span className="text-meta text-ink-subtle">added mid-range</span>
                    ) : null}
                  </div>
                  {h.name ? <Sub>{h.name}</Sub> : null}
                </Td>
                <Td tight className="text-ink-muted">
                  {formatLevelPercent(h.weight)}
                  <Sub>from {formatLevelPercent(h.entryWeight)}</Sub>
                </Td>
                <Td tight className="text-ink-muted">
                  {h.riskShare === null ? "—" : formatLevelPercent(h.riskShare)}
                </Td>
                <Td tight className={toneClass(h.returnPct)}>
                  {h.returnPct === null ? "—" : formatPercent(h.returnPct)}
                </Td>
                <Td tight className={toneClass(h.contribution)}>
                  {formatMoney(h.contribution, true)}
                </Td>
                <Td tight className="text-ink-muted">
                  {h.volatility === null ? "—" : formatLevelPercent(h.volatility)}
                </Td>
                <Td tight className="text-ink-muted">
                  {h.beta === null ? "—" : formatRatio(h.beta)}
                </Td>
                <Td tight className="text-ink-muted">
                  {h.maxDrawdown === null ? "—" : formatPercent(h.maxDrawdown)}
                </Td>
                <Td last tight className="text-ink-muted">
                  {h.correlationToBasket === null ? "—" : formatRatio(h.correlationToBasket)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Panel>
  );
}

function toneClass(value: number | null): string {
  if (value === null) return "text-ink-muted";
  const tone = moveTone(value);
  return tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-muted";
}
