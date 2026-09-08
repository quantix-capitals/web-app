/**
 * The basket dashboard.
 *
 * The ledger view answers "what is this worth?". This one answers the question
 * that actually decides whether a basket was a good idea: **did picking these
 * names beat simply buying the index, and what did it cost in risk to find
 * out?** Everything on the page is built for the *group* — the individual
 * charts are at the bottom, deliberately, because a basket is not a collection
 * of stocks you read one at a time.
 *
 * Reading order, top to bottom, is the order the question is asked:
 *
 * 1. One hero figure — the gap against NIFTY 50 — then the four figures that
 *    qualify it, then the risk-adjusted ones for a reader who wants them.
 * 2. **Performance**: the money, the gap, liquidity, month by month.
 * 3. **Risk**: drawdown, rolling volatility, rolling beta, the daily scatter.
 * 4. **Composition**: money against risk, who earned it, how alike the names
 *    are — the section that only exists because this is a group.
 * 5. **Holdings**: small multiples and the full table.
 * 6. The method note, so no figure on the page is unexplained.
 */

import { useState } from "react";
import {
  ActionStyle,
  EmptyState,
  SECTION_X,
  Section,
  SectionHeader,
  Stat,
  StatBand,
} from "@/components/ui/primitives";
import { IconWatchlist } from "@/components/shell/nav-icons";
import { Skeleton, SkeletonFigure } from "@/components/ui/skeleton";
import {
  cn,
  formatClock,
  formatDate,
  formatLevelPercent,
  formatMoney,
  formatPercent,
  formatRatio,
  moveTone,
} from "@/lib/format";
import { RISK_FREE_ANNUAL } from "@/lib/analytics/stats";
import {
  BENCHMARK_LABEL,
  RANGES,
  type BasketAnalytics,
  type Excluded,
  type RangeId,
} from "@/lib/analytics/basket";
import { useBasketAnalytics } from "@/lib/analytics/use-basket-analytics";
import type { WatchlistSummary } from "@/lib/watchlist/types";
import { Metric, MetricGrid } from "./panel";
import { EquityCurve, ExcessReturn, MonthlyReturns, Turnover } from "./performance";
import { BetaScatter, Drawdown, RollingBeta, RollingVolatility } from "./risk";
import { Contribution, Diversification, WeightVsRisk } from "./composition";
import { HoldingSparklines, HoldingsTable } from "./holdings";

export function Dashboard({ list }: { list: WatchlistSummary }) {
  const [range, setRange] = useState<RangeId>("all");
  // `range` is what was asked for; `effective` is what the loaded history could
  // honour. The strip highlights the second, so the label always describes the
  // chart underneath it.
  const {
    analytics,
    isPending,
    isError,
    error,
    asOf,
    missing,
    ranges,
    range: effective,
    refetch,
  } = useBasketAnalytics(list.id, list.items, range);

  if (!list.items.length) {
    return (
      <EmptyState
        icon={<IconWatchlist className="size-5" />}
        title="Nothing to analyse yet"
      >
        Add a symbol to this basket and the dashboard will pull its history back to the day it was
        struck.
      </EmptyState>
    );
  }

  if (isPending) return <DashboardLoading />;

  if (isError) {
    return (
      <div className="px-6 py-10">
        <div className="flex flex-wrap items-center gap-3 border border-line bg-loss-soft px-4 py-3 text-detail text-loss">
          <span>Could not load history{error ? ` — ${error}` : ""}.</span>
          <button type="button" onClick={refetch} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <EmptyState
        icon={<IconWatchlist className="size-5" />}
        title="No history to work from"
        action={
          <button type="button" onClick={refetch} className={ActionStyle({ variant: "ghost" })}>
            Try again
          </button>
        }
      >
        None of this basket&apos;s symbols came back with daily bars, or none of them has an entry
        price to measure from. Set an entry on the ledger and the dashboard will fill in.
      </EmptyState>
    );
  }

  return (
    <div>
      <Controls
        range={effective}
        ranges={ranges}
        onRange={setRange}
        asOf={asOf}
        struck={list.createdAt}
        onRefresh={refetch}
        analytics={analytics}
      />

      <Headline a={analytics} range={effective} />
      <Section className="bg-sunken">
        <RiskMetrics a={analytics} />
      </Section>

      {analytics.excluded.length || missing.length ? (
        <Exclusions excluded={analytics.excluded} missing={missing} />
      ) : null}

      <Section>
        <SectionHeader
          title="Performance"
          subtitle={`Against the same rupees put into ${BENCHMARK_LABEL} on the same days — the only comparison that says whether picking these was worth it.`}
        />
        <div className="divide-y divide-line">
          <EquityCurve a={analytics} />
          <ExcessReturn a={analytics} />
          <Turnover a={analytics} />
          <MonthlyReturns a={analytics} />
        </div>
      </Section>

      <Section>
        <SectionHeader
          title="Risk"
          subtitle="What holding this actually felt like, and how much of it was the market rather than the picks."
        />
        <div className="divide-y divide-line">
          <Drawdown a={analytics} />
          <RollingVolatility a={analytics} />
          <RollingBeta a={analytics} />
          <BetaScatter a={analytics} />
        </div>
      </Section>

      <Section>
        <SectionHeader
          title="Composition"
          subtitle="The questions a group raises that no single chart answers: where the risk sits, who earned the money, and whether these are separate bets at all."
        />
        <Diversification a={analytics} />
        <div className="divide-y divide-line border-t border-line">
          <WeightVsRisk a={analytics} />
          <Contribution a={analytics} />
        </div>
      </Section>

      <Section>
        <SectionHeader
          title="Holdings"
          subtitle="The individual names, last — a basket is not a collection of stocks you read one at a time."
        />
        <div className="divide-y divide-line">
          <HoldingSparklines a={analytics} />
          <HoldingsTable a={analytics} />
        </div>
      </Section>

      <Method a={analytics} />
    </div>
  );
}

/**
 * The filter row: one row, above everything, scoping every figure below it.
 *
 * Range is the only control here on purpose. A dashboard with a filter per
 * chart is a dashboard whose numbers disagree with each other.
 */
function Controls({
  range,
  ranges,
  onRange,
  asOf,
  struck,
  onRefresh,
  analytics,
}: {
  range: RangeId;
  ranges: RangeId[];
  onRange: (next: RangeId) => void;
  asOf: string | null;
  struck: string;
  onRefresh: () => void;
  analytics: BasketAnalytics;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-sunken py-2.5",
        SECTION_X,
      )}
    >
      <div className="flex items-center gap-1" role="group" aria-label="Date range">
        {RANGES.map((r) => {
          // A range the basket is too young for is offered as disabled rather
          // than silently falling back to the whole series — a button that
          // moves the highlight and changes nothing else reads as a bug.
          const available = ranges.includes(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onRange(r.id)}
              disabled={!available}
              aria-pressed={r.id === range}
              title={available ? undefined : "Not enough history yet"}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-meta font-medium transition",
                !available
                  ? "cursor-not-allowed text-ink-subtle/50"
                  : r.id === range
                    ? "bg-accent-soft text-accent-ink"
                    : "text-ink-muted hover:bg-canvas hover:text-ink",
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-meta text-ink-subtle">
        <span>
          {analytics.summary.tradingDays} sessions from {formatDate(new Date(analytics.dates[0]).toISOString())}
          {range === "all" ? ` · struck ${formatDate(struck)}` : ""}
          {asOf ? ` · marked ${formatClock(asOf)}` : ""}
        </span>
        {/* The ledger's totals drop a row the quote feed could not price; this
            page cannot — dropping one would tear a hole in the series — so it
            carries such a row at its last close. That is the only condition
            under which the two views can still disagree, and it says so. */}
        {analytics.summary.livePriced ? null : (
          <span className="text-ink-subtle">Some rows held at their last close</span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          className="font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

/**
 * One hero figure, then the four that qualify it.
 *
 * The hero is the excess return, not the basket's own return: the basket's
 * return alone cannot tell a good pick from a rising market, and this page
 * exists to separate the two. It is set in the serif at figure scale, like
 * every other measured number on this product.
 */
function Headline({ a, range }: { a: BasketAnalytics; range: RangeId }) {
  const s = a.summary;
  const excess = s.excessPct;
  // "Since entry" opens at the basket's cost, so the money figures are the
  // ledger's. A shorter window opens at a valuation instead, and saying
  // "invested" against it would price a month's move off a year-old cost.
  const sinceEntry = range === "all";

  return (
    <>
      <Section className="bg-canvas">
        <div className={cn("py-6", SECTION_X)}>
          <div className="text-meta font-medium tracking-wide text-ink-muted">
            {a.benchmarkAvailable ? `Against ${BENCHMARK_LABEL}` : "Return"}
          </div>
          <div
            className={cn(
              "mt-1.5 font-serif text-[2.75rem] leading-none tracking-tight tabular-nums",
              excess === null
                ? "text-ink"
                : moveTone(excess) === "gain"
                  ? "text-gain"
                  : moveTone(excess) === "loss"
                    ? "text-loss"
                    : "text-ink",
            )}
          >
            {excess === null
              ? s.returnPct === null
                ? "—"
                : formatPercent(s.returnPct)
              : formatPercent(excess)}
          </div>
          <p className="mt-2.5 max-w-[70ch] text-detail leading-relaxed text-ink-muted">
            {excess === null || s.returnPct === null || s.benchmarkReturnPct === null ? (
              "The index could not be priced for this range, so the basket's return stands on its own."
            ) : (
              <>
                The basket returned {formatPercent(s.returnPct)} while {BENCHMARK_LABEL} returned{" "}
                {formatPercent(s.benchmarkReturnPct)}.{" "}
                {excess >= 0
                  ? `Picking these was worth ${formatMoney(s.marketValue - (s.benchmarkValue ?? s.marketValue), true)} over simply buying the index with the same money.`
                  : `Simply buying the index with the same money would have been ${formatMoney(Math.abs(s.marketValue - (s.benchmarkValue ?? s.marketValue)))} better.`}
              </>
            )}
          </p>
        </div>
      </Section>

      <Section className="bg-sunken">
        <StatBand>
          <Stat
            label="Value now"
            value={formatMoney(s.marketValue)}
            hint={
              sinceEntry
                ? `${formatMoney(s.invested)} invested`
                : `${formatMoney(s.openingValue)} at window start`
            }
          />
          <Stat
            label={sinceEntry ? "Gain" : "Change"}
            value={formatMoney(s.gain, true)}
            hint={s.returnPct === null ? undefined : formatPercent(s.returnPct)}
            tone={moveTone(s.gain)}
          />
          <Stat
            label="Annualised"
            value={s.cagr === null ? "—" : formatPercent(s.cagr)}
            hint={
              s.benchmarkCagr === null
                ? `${s.calendarDays} days of history`
                : `${BENCHMARK_LABEL} ${formatPercent(s.benchmarkCagr)}`
            }
            tone={s.cagr === null ? "neutral" : moveTone(s.cagr)}
          />
          <Stat
            label="Worst fall"
            value={s.drawdown ? formatPercent(s.drawdown.depth) : "—"}
            hint={
              s.benchmarkDrawdownDepth === null
                ? undefined
                : `${BENCHMARK_LABEL} ${formatPercent(s.benchmarkDrawdownDepth)}`
            }
            tone={s.drawdown ? "loss" : "neutral"}
          />
        </StatBand>
      </Section>
    </>
  );
}

/**
 * The risk-adjusted figures, at a quarter of the hero's weight.
 *
 * They belong on the page — a return without them is half a story — but a
 * reader who only wants "did it work" should be able to skip the whole row, so
 * every one of them is small, quiet, and carries its definition on hover.
 */
function RiskMetrics({ a }: { a: BasketAnalytics }) {
  const s = a.summary;
  const fit = s.fit;

  return (
    <MetricGrid>
      <Metric
        label="Sharpe"
        value={s.sharpe === null ? "—" : formatRatio(s.sharpe)}
        hint="return per unit of risk"
        title={`Excess return over a ${formatLevelPercent(RISK_FREE_ANNUAL, 0)} risk-free rate, divided by annualised volatility. Above 1 is good; above 2 is rare and usually means a short sample.`}
        tone={s.sharpe === null ? "neutral" : s.sharpe > 1 ? "gain" : "neutral"}
      />
      <Metric
        label="Sortino"
        value={s.sortino === null ? "—" : formatRatio(s.sortino)}
        hint="downside only"
        title="Sharpe, but the denominator counts only losing days. Much higher than the Sharpe means the volatility was mostly upside."
      />
      <Metric
        label="Volatility"
        value={s.volatility === null ? "—" : formatLevelPercent(s.volatility)}
        hint={
          s.benchmarkVolatility === null
            ? "annualised"
            : `index ${formatLevelPercent(s.benchmarkVolatility)}`
        }
        title="Annualised standard deviation of daily returns — σ of the daily series times √252."
      />
      <Metric
        label="Beta"
        value={fit === null ? "—" : formatRatio(fit.beta)}
        hint={fit === null ? "needs 20 sessions" : `R² ${formatRatio(fit.rSquared)}`}
        title={`How hard the basket moves when ${BENCHMARK_LABEL} moves. 1.0 is in step; 1.4 is 40% harder in both directions.`}
      />
      <Metric
        label="Alpha"
        value={fit === null ? "—" : formatPercent(fit.alpha)}
        hint="annualised, beta-adjusted"
        title="Jensen's alpha: the return left over once the basket's market exposure is paid for. This is the part the picks are actually responsible for."
        tone={fit === null ? "neutral" : moveTone(fit.alpha)}
      />
      <Metric
        label="Information ratio"
        value={fit?.informationRatio == null ? "—" : formatRatio(fit.informationRatio)}
        hint={fit === null ? undefined : `tracking error ${formatLevelPercent(fit.trackingError)}`}
        title="Excess return over the index divided by how much that excess bounces around. The Sharpe ratio of the active bet itself."
      />

      <Metric
        label="Up capture"
        value={fit?.upCapture == null ? "—" : formatLevelPercent(fit.upCapture)}
        hint="of the index's up days"
        title="On days the index rose, the share of its rise the basket captured. Above 100% is leverage to the good days."
      />
      <Metric
        label="Down capture"
        value={fit?.downCapture == null ? "—" : formatLevelPercent(fit.downCapture)}
        hint="of the index's down days"
        title="On days the index fell, the share of its fall the basket took. Below 100% is the defensive half of a good basket — and the number most people forget to check."
        tone={fit?.downCapture != null && fit.downCapture < 1 ? "gain" : "neutral"}
      />
      <Metric
        label="Beat the index"
        value={fit === null ? "—" : formatLevelPercent(fit.hitRate)}
        hint={`of ${s.tradingDays} sessions`}
        title="Share of sessions the basket returned more than the index. A high hit rate with a negative excess return means a few very bad days."
      />
      <Metric
        label="Calmar"
        value={s.calmar === null ? "—" : formatRatio(s.calmar)}
        hint="return per unit of drawdown"
        title="Annualised return divided by the worst peak-to-trough fall. The ratio for a reader who measures risk by pain rather than by variance."
      />
      <Metric
        label="Value at risk"
        value={s.var95 === null ? "—" : formatPercent(s.var95)}
        hint="worst 1 day in 20"
        title="Historical 95% VaR: the daily loss the worst 5% of sessions exceeded. Taken from the actual distribution, not assumed normal — daily equity returns have fatter tails than that."
        tone={s.var95 === null ? "neutral" : "loss"}
      />
      <Metric
        label="Best / worst day"
        value={
          s.bestDay === null || s.worstDay === null
            ? "—"
            : `${formatPercent(s.bestDay, 1)} / ${formatPercent(s.worstDay, 1)}`
        }
        hint={`${s.positiveDays} of ${Math.max(1, s.tradingDays - 1)} up`}
        title="The single best and worst sessions in the range, and how many sessions closed higher than they opened the day on."
      />
    </MetricGrid>
  );
}

/** Symbols the maths had to leave out, said plainly rather than silently dropped. */
function Exclusions({ excluded, missing }: { excluded: Excluded[]; missing: string[] }) {
  const noBaseline = excluded.filter((e) => e.reason === "no-baseline");
  const noHistory = excluded.filter((e) => e.reason === "no-history");

  return (
    <div className={cn("border-b border-line bg-warn-soft py-2.5 text-detail text-warn", SECTION_X)}>
      {noBaseline.length ? (
        <p>
          Left out for want of an entry price: {noBaseline.map((e) => e.symbol).join(", ")}. Set an
          entry on the ledger and they will join the figures above.
        </p>
      ) : null}
      {noHistory.length || missing.length ? (
        <p className={noBaseline.length ? "mt-1" : undefined}>
          No daily history from Yahoo for{" "}
          {[...new Set([...noHistory.map((e) => e.symbol), ...missing])].join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

/**
 * How every number above was arrived at.
 *
 * Collapsed, because most readings do not need it — but present, because a
 * dashboard that quotes a Sharpe ratio without saying which risk-free rate it
 * used is quoting a number nobody can check.
 */
function Method({ a }: { a: BasketAnalytics }) {
  return (
    <Section flush className="bg-sunken">
      <details className={cn("py-4", SECTION_X)}>
        <summary className="cursor-pointer text-detail font-medium text-ink-muted marker:text-ink-subtle hover:text-ink">
          How these figures are worked out
        </summary>
        <div className="mt-3 max-w-[80ch] space-y-2.5 text-detail leading-relaxed text-ink-muted">
          <p>
            <b className="font-medium text-ink">Prices.</b> Daily closes from Yahoo, adjusted for
            splits and dividends, anchored to each holding&apos;s recorded entry price. The path is
            walked on the adjusted series so a stock split reads as a split rather than as a 80%
            loss; the level is anchored to the raw entry price so the dashboard and the ledger agree
            on what was paid.
          </p>
          <p>
            <b className="font-medium text-ink">The basket.</b> Valued in rupees —{" "}
            <span className="font-mono text-meta">quantity × price</span>, summed — never as an
            average of per-holding percentages. Before a holding&apos;s entry date its money is held
            at cost, so a name added last week does not distort a basket struck last year.
          </p>
          <p>
            <b className="font-medium text-ink">The benchmark.</b> {BENCHMARK_LABEL} (
            <span className="font-mono text-meta">^NSEI</span>) as a counterfactual, not a line: the
            same rupees, put into the index on the same days each holding was added. That is what
            makes &ldquo;ahead by {a.summary.excessPct === null ? "x%" : formatPercent(a.summary.excessPct)}&rdquo; a
            statement about the picks rather than about the market.
          </p>
          <p>
            <b className="font-medium text-ink">Risk.</b> Daily simple returns, annualised by √252
            for volatility and geometrically for return. Sharpe and Sortino subtract a{" "}
            {formatLevelPercent(RISK_FREE_ANNUAL, 0)} annual risk-free rate. Beta, alpha, capture and
            tracking error come from a regression of the basket&apos;s daily returns on the
            index&apos;s, over {a.summary.fit?.observations ?? 0} paired sessions — under 20 they are
            not shown at all, because a slope fitted through a fortnight will agree with any thesis
            you bring it.
          </p>
          <p>
            <b className="font-medium text-ink">Risk shares</b> are marginal contributions to
            variance (<span className="font-mono text-meta">wᵢ·(Σw)ᵢ / σ²</span>) and sum to 100%.
            They account for a holding&apos;s own volatility <em>and</em> its correlation with the
            rest, which is why they rarely match the weights.
          </p>
          <p className="text-ink-subtle">
            Historical figures, computed from public closing prices. Not advice, and past behaviour
            of a basket is not a forecast of it.
          </p>
        </div>
      </details>
    </Section>
  );
}

/** The dashboard's shape before its bars arrive — same regions, same heights. */
function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading dashboard">
      <div className={cn("flex items-center justify-between border-b border-line bg-sunken py-3", SECTION_X)}>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className={cn("py-6", SECTION_X)}>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-10 w-48" />
        <Skeleton className="mt-3 h-3 w-96 max-w-full" />
      </div>
      <Section className="bg-sunken">
        <StatBand>
          <Stat label="Value now" value={<SkeletonFigure />} />
          <Stat label="Gain" value={<SkeletonFigure />} />
          <Stat label="Annualised" value={<SkeletonFigure />} />
          <Stat label="Worst fall" value={<SkeletonFigure />} />
        </StatBand>
      </Section>
      <div className={cn("py-6", SECTION_X)}>
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-4 h-80 w-full" />
      </div>
    </div>
  );
}
