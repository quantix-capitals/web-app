/**
 * The Analyst tab: every run kept, one open at a time, and a new run that builds
 * on whichever earlier ones you tick.
 *
 * It replaced a side panel that held one review for as long as the panel was
 * open. A review is advice somebody may act on, and advice that disappears when
 * a drawer closes cannot be checked later — so every run is now a stored,
 * addressable document (`?view=analyst&run=<id>`) with its tables, charts and
 * questions, and the list on the left is the record of what was said and when.
 *
 * Opening the tab loads prices; it does not run the model. Spending someone's
 * tokens is an action, so it waits for a click, and says what the click will do
 * and what it will be given.
 */

import { ActionStyle, Badge, CheckField } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { IconAgent } from "@/components/shell/nav-icons";
import { cn, formatClock, formatDate } from "@/lib/format";
import { KEY_SETUP } from "@/lib/analyst/client";
import type { RunSummary } from "@/lib/analyst/types";
import type { UseAnalyst } from "@/lib/analyst/use-analyst";
import type { WatchlistSummary } from "@/lib/watchlist/types";
import { Counts, RunReport } from "./run-report";

export function AnalystView({
  list,
  analyst,
  onSelect,
  onOpenBrief,
}: {
  list: WatchlistSummary;
  analyst: UseAnalyst;
  onSelect: (id: string) => void;
  onOpenBrief: () => void;
}) {
  const waitingForList = analyst.runsStatus === "loading" && analyst.selectedRunId === null;

  return (
    // `items-start` is what lets the run list's `sticky` work against this row:
    // a stretched flex child is as tall as the report and has nowhere to stick.
    <div className="flex flex-col lg:flex-row lg:items-start">
      <RunList analyst={analyst} onSelect={onSelect} />
      <div className="min-w-0 flex-1">
        {waitingForList ? (
          <PaneSkeleton />
        ) : analyst.selectedRunId === null ? (
          <NewRun analyst={analyst} onOpenBrief={onOpenBrief} />
        ) : (
          <SelectedRun list={list} analyst={analyst} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}

// --- the list ----------------------------------------------------------------

function RunList({ analyst, onSelect }: { analyst: UseAnalyst; onSelect: (id: string) => void }) {
  const { runs, selectedRunId, running, runningContext, runsStatus, runsError } = analyst;
  const newActive = selectedRunId === null && runsStatus !== "loading";

  return (
    <nav
      aria-label="Analyst runs"
      // On a wide screen the list is its own scroller, pinned under the basket's
      // header and tabs (`--basket-chrome`, measured in `basket.tsx`) and as tall
      // as the rest of the viewport — so a long list of runs scrolls without
      // moving the report, and a long report scrolls without losing the list.
      className="shrink-0 border-b border-line bg-sunken lg:sticky lg:top-[var(--basket-chrome,0px)] lg:h-[calc(100dvh-var(--basket-chrome,0px))] lg:w-72 lg:overflow-y-auto lg:border-r lg:border-b-0"
    >
      <div className="bg-sunken px-6 py-4 lg:sticky lg:top-0 lg:z-10 lg:px-4">
        <button
          type="button"
          onClick={() => onSelect("new")}
          aria-current={newActive ? "page" : undefined}
          className={cn(ActionStyle({ variant: newActive ? "primary" : "ghost" }), "w-full")}
        >
          <IconAgent className="size-4" />
          New run
        </button>
      </div>

      {running ? (
        <div className="border-t border-line px-6 py-3 lg:px-4" role="status">
          <p className="text-detail font-medium text-ink">Running now…</p>
          <p className="mt-0.5 text-meta text-ink-subtle">
            {runningContext.length
              ? `Building on ${runningContext.join(", ")}`
              : "No earlier runs as context"}
          </p>
        </div>
      ) : null}

      {runsStatus === "error" ? (
        <p className="border-t border-line px-6 py-3 text-meta leading-relaxed text-loss lg:px-4">
          {runsError}
        </p>
      ) : null}

      {runsStatus === "loading" ? (
        <div className="space-y-3 border-t border-line px-6 py-4 lg:px-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : null}

      {runsStatus === "ready" && !runs.length ? (
        <p className="border-t border-line px-6 py-4 text-meta leading-relaxed text-ink-subtle lg:px-4">
          No runs yet. Every run is kept here, with what it recommended and what you asked it.
        </p>
      ) : null}

      {runs.length ? (
        <ol className="max-h-80 overflow-y-auto border-t border-line lg:max-h-none lg:overflow-visible">
          {runs.map((run) => (
            <li key={run.id}>
              <RunRow
                run={run}
                runs={runs}
                active={run.id === selectedRunId}
                onClick={() => onSelect(run.id)}
              />
            </li>
          ))}
        </ol>
      ) : null}
    </nav>
  );
}

function RunRow({
  run,
  runs,
  active,
  onClick,
}: {
  run: RunSummary;
  runs: RunSummary[];
  active: boolean;
  onClick: () => void;
}) {
  const built = run.contextRunIds
    .map((id) => runs.find((r) => r.id === id)?.label)
    .filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block w-full border-b border-l-2 border-b-line px-6 py-3 text-left transition lg:px-4",
        active ? "border-l-accent bg-canvas" : "border-l-transparent hover:bg-canvas",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-body font-medium text-ink">{run.label}</span>
        <span className="text-meta tabular-nums text-ink-subtle">
          {formatDate(run.at)} · {formatClock(run.at)}
        </span>
      </div>
      <div className="mt-1.5">
        <Counts counts={run.counts} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-meta leading-relaxed text-ink-muted">{run.summary}</p>
      <p className="mt-1 text-meta text-ink-subtle">
        {built.length ? `Built on ${built.join(", ")}` : "No earlier runs as context"}
      </p>
    </button>
  );
}

// --- a new run ---------------------------------------------------------------

function NewRun({ analyst, onOpenBrief }: { analyst: UseAnalyst; onOpenBrief: () => void }) {
  const {
    needsKey,
    prices,
    brief,
    briefLoading,
    briefUsable,
    runs,
    includeBrief,
    setIncludeBrief,
    contextIds,
    setContextIds,
    running,
    runError,
    retrySave,
    analyse,
  } = analyst;

  const ready = prices.status === "ready" && prices.holdingCount > 0 && !needsKey && !running;
  const toggle = (id: string, on: boolean) =>
    setContextIds(on ? [...contextIds, id] : contextIds.filter((x) => x !== id));

  return (
    <div className="max-w-3xl space-y-6 px-6 py-6">
      <div>
        <h2 className="font-serif text-title tracking-tight text-ink">New analyst run</h2>
        <p className="mt-2 text-detail leading-relaxed text-ink-muted">
          I read every symbol in this basket against its own trend and against NIFTY 50, judge it
          against the basket&apos;s brief and timeline, search for what has been announced since, then
          tell you what to keep, what to sell, and what to buy or add instead. Prices I measure; news
          I cite. The run is saved here with its tables and charts, and you can question it later.
        </p>
      </div>

      {needsKey ? <NotConfigured /> : null}

      {prices.status === "loading" ? (
        <div className="space-y-2" role="status" aria-label="Loading prices">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      ) : null}

      {prices.status === "error" ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-loss-soft px-3 py-2.5 text-detail text-loss">
          <span>{prices.error}</span>
          <button type="button" onClick={prices.retry} className="font-medium underline underline-offset-2">
            Retry prices
          </button>
        </p>
      ) : null}

      {prices.status === "ready" && prices.heldCount === 0 ? (
        <p className="text-detail leading-relaxed text-ink-muted">
          Nothing to review yet. Add symbols to this basket and I will tell you what to keep and
          what to sell.
        </p>
      ) : null}

      {prices.status === "ready" && prices.skipped.length ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-warn-soft px-3 py-2.5 text-detail leading-relaxed text-warn">
          <span>
            The price feed returned nothing for {prices.skipped.join(", ")}, so{" "}
            {prices.holdingCount === 0 ? "there is nothing I can judge yet" : "I will leave it out of this run"}.
            Check the symbol and exchange on the ledger, or try again.
          </span>
          <button type="button" onClick={prices.retry} className="font-medium underline underline-offset-2">
            Retry prices
          </button>
        </p>
      ) : null}

      {prices.benchUnavailable && prices.status === "ready" ? (
        <p className="bg-warn-soft px-3 py-2.5 text-meta leading-relaxed text-warn">
          The replacement bench did not load, so I can tell you what to sell but not what to buy
          instead.
        </p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-meta font-medium tracking-wide text-ink-muted">The brief</legend>
        {briefLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : briefUsable ? (
          <CheckField
            checked={includeBrief}
            onChange={setIncludeBrief}
            label="Give the analyst this basket's brief"
          >
            Recommended. Each call, replacement and addition is judged against why this basket
            exists, its timeline, and the pluses, minuses, targets and stops set for each holding.
          </CheckField>
        ) : (
          <p className="rounded-md border border-line bg-sunken px-3 py-2.5 text-detail leading-relaxed text-ink-muted">
            {brief
              ? "This basket's brief is empty, so there is nothing to judge it against."
              : "This basket has no brief, so I can judge the holdings but not whether the basket is doing what it was struck for."}{" "}
            <button
              type="button"
              onClick={onOpenBrief}
              className="font-medium text-accent-ink underline underline-offset-2"
            >
              {brief ? "Fill it in" : "Write one"}
            </button>
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <legend className="text-meta font-medium tracking-wide text-ink-muted">
            Earlier runs to build on
          </legend>
          {runs.length ? (
            <span className="flex items-center gap-3 text-meta">
              <button
                type="button"
                onClick={() => setContextIds(runs.slice(0, 1).map((r) => r.id))}
                className="text-ink-muted underline underline-offset-2 hover:text-ink"
              >
                Latest only
              </button>
              <button
                type="button"
                onClick={() => setContextIds(runs.slice(0, 5).map((r) => r.id))}
                className="text-ink-muted underline underline-offset-2 hover:text-ink"
              >
                Last five
              </button>
              <button
                type="button"
                onClick={() => setContextIds([])}
                className="text-ink-muted underline underline-offset-2 hover:text-ink"
              >
                None
              </button>
            </span>
          ) : null}
        </div>

        {runs.length ? (
          <>
            <p className="text-meta leading-relaxed text-ink-subtle">
              Ticked runs are handed over with their calls, what they expected to happen, and every
              question you put to them — so the analyst can say what changed, and answer your
              objections rather than repeat itself. Untick them all for a fresh opinion.
            </p>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {runs.slice(0, 20).map((run) => (
                <CheckField
                  key={run.id}
                  checked={contextIds.includes(run.id)}
                  onChange={(on) => toggle(run.id, on)}
                  label={`${run.label} · ${formatDate(run.at)}`}
                >
                  <span className="line-clamp-2">{run.summary}</span>
                </CheckField>
              ))}
            </div>
          </>
        ) : (
          <p className="text-meta text-ink-subtle">
            None yet — this first run starts from scratch.
          </p>
        )}
      </fieldset>

      {runError ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-loss-soft px-3 py-2.5 text-detail leading-relaxed text-loss">
          <span>{runError}</span>
          <button
            type="button"
            onClick={retrySave ?? analyse}
            className="font-medium underline underline-offset-2"
          >
            {retrySave ? "Retry saving" : "Run again"}
          </button>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <button type="button" onClick={analyse} disabled={!ready} className={cn(ActionStyle(), !ready && "opacity-50")}>
          {running
            ? "Running…"
            : `Analyse ${prices.holdingCount || ""} ${prices.holdingCount === 1 ? "holding" : "holdings"}`}
        </button>
        <span className="flex flex-wrap items-center gap-1.5 text-meta text-ink-subtle">
          <Badge tone={briefUsable && includeBrief ? "accent" : "neutral"}>
            {briefUsable && includeBrief ? "With brief" : "Without brief"}
          </Badge>
          <Badge tone={contextIds.length ? "accent" : "neutral"}>
            {contextIds.length
              ? `${contextIds.length} earlier ${contextIds.length === 1 ? "run" : "runs"}`
              : "No earlier runs"}
          </Badge>
        </span>
      </div>

      {running ? <Thinking analyst={analyst} /> : null}
    </div>
  );
}

/**
 * The wait while the model works. It names the steps rather than spinning,
 * because this wait is long enough that a bare spinner reads as a hang.
 */
function Thinking({ analyst }: { analyst: UseAnalyst }) {
  const steps = [
    "Reading the basket and the live marks",
    analyst.briefUsable && analyst.includeBrief
      ? "Reading the brief: motive, timeline, pluses and minuses"
      : null,
    analyst.runningContext.length
      ? `Reading its earlier runs: ${analyst.runningContext.join(", ")}`
      : null,
    "Searching for recent news and launches",
    "Screening the bench for replacements and additions",
    "Forming a verdict on each holding",
  ].filter((s): s is string => Boolean(s));

  return (
    <div className="space-y-2" role="status">
      <p className="text-detail font-medium text-ink">Working… this usually takes a minute or two.</p>
      <ul className="space-y-1.5">
        {steps.map((step) => (
          <li key={step} className="flex items-start gap-2 text-detail text-ink-muted">
            <span aria-hidden className="mt-[0.6em] h-px w-2 shrink-0 bg-line-strong" />
            {step}
          </li>
        ))}
      </ul>
      <p className="text-meta text-ink-subtle">
        You can switch to the ledger while it runs. The result is saved and opened here when it is done.
      </p>
    </div>
  );
}

/**
 * What the tab says when the build has no key. It names the file and variable
 * rather than offering a field to paste into: a second place to put a key is a
 * second place to leak it from.
 */
function NotConfigured() {
  return (
    <div className="space-y-2 rounded-md border border-line bg-sunken px-3 py-3">
      <p className="text-detail leading-relaxed text-ink-muted">
        The analyst has no OpenAI key to run on. Set{" "}
        <code className="font-mono text-ink">{KEY_SETUP.keyVar}</code> in{" "}
        <code className="font-mono text-ink">{KEY_SETUP.file}</code>, then restart the dev server.
      </p>
      <p className="text-meta leading-relaxed text-ink-subtle">
        <code className="font-mono">{KEY_SETUP.modelVar}</code> sets the model. Saved runs stay
        readable without a key.
      </p>
    </div>
  );
}

// --- a stored run --------------------------------------------------------------

function SelectedRun({
  list,
  analyst,
  onSelect,
}: {
  list: WatchlistSummary;
  analyst: UseAnalyst;
  onSelect: (id: string) => void;
}) {
  if (analyst.runStatus === "loading") return <PaneSkeleton />;

  if (analyst.runStatus === "error") {
    return <p className="px-6 py-6 text-detail text-loss">{analyst.runLoadError}</p>;
  }

  if (!analyst.run) {
    return (
      <div className="space-y-3 px-6 py-6">
        <p className="text-detail text-ink-muted">This run no longer exists.</p>
        <button type="button" onClick={() => onSelect("new")} className={ActionStyle({ variant: "ghost" })}>
          Start a new run
        </button>
      </div>
    );
  }

  return (
    <RunReport
      key={analyst.run.id}
      list={list}
      run={analyst.run}
      analyst={analyst}
      onSelect={onSelect}
    />
  );
}

function PaneSkeleton() {
  return (
    <div className="space-y-3 px-6 py-6" role="status" aria-label="Loading">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-3 w-72 max-w-full" />
      <Skeleton className="h-3 w-64 max-w-full" />
      <Skeleton className="mt-6 h-48 w-full" />
    </div>
  );
}
