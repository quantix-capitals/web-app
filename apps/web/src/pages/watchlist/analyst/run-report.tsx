/**
 * One stored analyst run, read back.
 *
 * Laid out the way the run is meant to be read: the verdict counts and summary,
 * how the basket stands against its brief, two charts, the calls as a table,
 * any names worth adding, then each holding's full case — and at the bottom the
 * questions asked of this run, which carry on from where it left off.
 *
 * Every figure here is the one the run was made on. A run from March shows
 * March's returns, because the point of keeping it is to see what was advised
 * on what was known then.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActionStyle, Badge, Meter, SymbolLink } from "@/components/ui/primitives";
import { HeadRow, Sub, Table, Td, Th, Tr } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatClock, formatDate, formatLevelPercent, formatPercent, moveTone } from "@/lib/format";
import type { Tone } from "@/lib/types";
import {
  downloadMarkdown,
  FIT_WORD,
  runFilename,
  THESIS_WORD,
  VERDICT_WORD,
} from "@/lib/analyst/report";
import type {
  BriefFit,
  HoldingReview,
  Report,
  RunRecord,
  ThesisStatus,
  Verdict,
} from "@/lib/analyst/types";
import type { UseAnalyst } from "@/lib/analyst/use-analyst";
import type { WatchlistSummary } from "@/lib/watchlist/types";
import { Prose } from "./prose";
import { VerdictCard } from "./verdict-card";
import { ConvictionChart, PlanChart } from "./run-charts";

const VERDICT_TONE: Record<Verdict, Tone> = { add: "gain", keep: "gain", trim: "warn", sell: "loss" };

const FIT_TONE: Record<BriefFit, Tone> = {
  fits: "gain",
  drifting: "warn",
  breaks: "loss",
  not_in_brief: "neutral",
};

const THESIS_TONE: Record<ThesisStatus, Tone> = {
  on_track: "gain",
  mixed: "warn",
  off_track: "loss",
  no_brief: "neutral",
};

/** The verdict counts as badges. Colour never carries the verdict alone. */
export function Counts({ counts }: { counts: Record<Verdict, number> }) {
  const order: Verdict[] = ["sell", "trim", "add", "keep"];
  const shown = order.filter((v) => counts[v]);
  if (!shown.length) return <Badge tone="neutral">No calls</Badge>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((v) => (
        <Badge key={v} tone={VERDICT_TONE[v]}>
          {counts[v]} {v}
        </Badge>
      ))}
    </span>
  );
}

export function RunReport({
  list,
  run,
  analyst,
  onSelect,
}: {
  list: WatchlistSummary;
  run: RunRecord;
  analyst: UseAnalyst;
  onSelect: (id: string) => void;
}) {
  const { report } = run;

  return (
    <article className="pb-2">
      <RunHeader list={list} run={run} analyst={analyst} onSelect={onSelect} />

      <Block title="Summary">
        <Prose text={report.summary} />
        <p className="mt-3 text-meta leading-relaxed text-ink-subtle">{report.regime.label}.</p>
      </Block>

      {run.briefMarkdown ? (
        <Block title="Against the brief">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={THESIS_TONE[report.thesis.status]}>{THESIS_WORD[report.thesis.status]}</Badge>
          </div>
          {report.thesis.assessment ? (
            <Prose className="mt-2" text={report.thesis.assessment} />
          ) : null}
        </Block>
      ) : null}

      {report.holdings.length ? (
        <div className="grid border-b border-line xl:grid-cols-2">
          <ConvictionChart holdings={report.holdings} />
          <PlanChart holdings={report.holdings} />
        </div>
      ) : null}

      <CallsTable report={report} />

      {report.additions.length ? (
        <Block
          title="Ideas to add"
          reading="New positions, not swaps — names from the bench that serve this basket's brief."
        >
          <ul className="space-y-3">
            {report.additions.map((idea) => (
              <li key={idea.symbol} className="border-l-2 border-accent pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SymbolLink
                    symbol={idea.symbol}
                    exchange={idea.exchange}
                    className="font-mono text-body font-medium text-ink"
                  />
                  <span className="text-meta text-ink-subtle">
                    {idea.name} · {idea.sector} · screen {idea.score}
                  </span>
                </div>
                <p className="mt-1 text-detail leading-relaxed text-ink-muted">{idea.rationale}</p>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {report.sectors.length || report.unclassified.length ? (
        <Block title="Sector weights" reading="By market value when the run was made.">
          <div className="max-w-xl space-y-1.5">
            {report.sectors.map((sector) => (
              <div key={sector.sector} className="flex items-center gap-2">
                <span className="w-36 shrink-0 truncate text-meta text-ink-muted">{sector.sector}</span>
                <Meter value={sector.weight * 100} tone="neutral" label={sector.sector} />
                <span className="w-12 shrink-0 text-right text-meta tabular-nums text-ink-subtle">
                  {formatLevelPercent(sector.weight, 0)}
                </span>
              </div>
            ))}
          </div>
          {report.unclassified.length ? (
            <p className="mt-2 text-meta leading-relaxed text-ink-subtle">
              No sector on file for {report.unclassified.join(", ")}, so they are left out of the
              weights rather than counted as one.
            </p>
          ) : null}
        </Block>
      ) : null}

      <section className="border-b border-line">
        <h3 className="px-6 pt-5 pb-2 text-body font-semibold tracking-tight text-ink">
          Each holding in full
        </h3>
        <div className="max-w-4xl">
          {report.holdings.map((holding) => (
            <VerdictCard key={holding.key} holding={holding} onAsk={analyst.ask} />
          ))}
        </div>
        {report.skipped.length ? (
          <p className="px-6 py-3 text-meta leading-relaxed text-ink-subtle">
            Not judged, no price data at all: {report.skipped.join(", ")}.
          </p>
        ) : null}
      </section>

      {run.briefMarkdown ? (
        <details className="group border-b border-line px-6 py-4">
          <summary className="cursor-pointer text-detail font-medium text-ink-muted hover:text-ink">
            The brief as this run read it
          </summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-meta leading-relaxed text-ink-muted">
            {run.briefMarkdown}
          </pre>
        </details>
      ) : null}

      <Conversation run={run} analyst={analyst} />
    </article>
  );
}

// --- header ------------------------------------------------------------------

function RunHeader({
  list,
  run,
  analyst,
  onSelect,
}: {
  list: WatchlistSummary;
  run: RunRecord;
  analyst: UseAnalyst;
  onSelect: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await analyst.removeRun(run.id);
      onSelect("new");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the run.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-6 py-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="font-serif text-title tracking-tight text-ink">Run {run.label}</h2>
          <Counts counts={run.counts} />
        </div>
        <p className="mt-1.5 text-meta text-ink-muted">
          {formatDate(run.at)} at {formatClock(run.at)}
          {run.model ? ` · ${run.model}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-meta text-ink-subtle">
          <Badge tone={run.briefMarkdown ? "accent" : "neutral"}>
            {run.briefMarkdown ? "Brief included" : "No brief"}
          </Badge>
          {run.contextRunIds.length ? (
            <>
              <span className="ml-1">Built on</span>
              {run.contextRunIds.map((id) => {
                const label = analyst.runs.find((r) => r.id === id)?.label;
                return label ? (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelect(id)}
                    className="font-mono text-accent-ink underline underline-offset-2"
                  >
                    {label}
                  </button>
                ) : (
                  <span key={id}>a deleted run</span>
                );
              })}
            </>
          ) : (
            <span className="ml-1">No earlier runs as context</span>
          )}
        </div>
        {error ? <p className="mt-2 text-meta text-loss">{error}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => downloadMarkdown(runFilename(list.name, run.label), run.markdown)}
          className={ActionStyle({ variant: "ghost" })}
        >
          Download .md
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          onBlur={() => setConfirming(false)}
          disabled={deleting}
          className={cn(
            "rounded-md px-3 py-2 text-body font-medium transition",
            confirming ? "bg-loss-soft text-loss" : "text-ink-subtle hover:bg-loss-soft hover:text-loss",
          )}
        >
          {deleting ? "Deleting…" : confirming ? "Really delete?" : "Delete"}
        </button>
      </div>
    </header>
  );
}

function Block({
  title,
  reading,
  children,
}: {
  title: string;
  reading?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line px-6 py-5">
      <h3 className="text-body font-semibold tracking-tight text-ink">{title}</h3>
      {reading ? <p className="mt-0.5 text-detail text-ink-muted">{reading}</p> : null}
      <div className="mt-3 max-w-[72ch]">{children}</div>
    </section>
  );
}

// --- the calls ---------------------------------------------------------------

function planState(h: HoldingReview): { label: string; tone: Tone } | null {
  const since = h.signals.sinceEntry;
  if (!h.plan || since === null) return null;
  if (h.plan.target !== null && since >= h.plan.target) return { label: "Target hit", tone: "gain" };
  if (h.plan.stop !== null && since <= h.plan.stop) return { label: "Stop hit", tone: "loss" };
  return null;
}

function CallsTable({ report }: { report: Report }) {
  if (!report.holdings.length) return null;

  return (
    <section className="border-b border-line">
      <h3 className="px-6 pt-5 text-body font-semibold tracking-tight text-ink">The calls</h3>
      <p className="px-6 pt-0.5 pb-2 text-detail text-ink-muted">
        Lowest conviction first. Returns and plan checks are as measured when the run was made.
      </p>
      <Table minWidth="min-w-190">
        <HeadRow>
          <Th align="left" first grow>
            Holding
          </Th>
          <Th tight>Call</Th>
          <Th tight>Score</Th>
          <Th tight>Last run</Th>
          <Th tight>Since entry</Th>
          <Th tight>Target / stop</Th>
          <Th align="left" tight>
            Brief
          </Th>
          <Th align="left" last tight>
            Instead
          </Th>
        </HeadRow>
        <tbody>
          {report.holdings.map((h) => {
            const delta = h.previous ? h.score - h.previous.score : null;
            const state = planState(h);
            return (
              <Tr key={h.key}>
                <Td align="left" first grow>
                  <SymbolLink symbol={h.symbol} exchange={h.exchange} className="font-mono font-medium text-ink" />
                  <Sub className="truncate">{h.headline}</Sub>
                </Td>
                <Td tight>
                  <Badge tone={VERDICT_TONE[h.verdict]}>{VERDICT_WORD[h.verdict]}</Badge>
                </Td>
                <Td tight className="text-ink">
                  {h.score}
                  <Sub>screen {h.screen}</Sub>
                </Td>
                <Td tight className="text-ink-muted">
                  {h.previous ? `${VERDICT_WORD[h.previous.verdict]} ${h.previous.score}` : "—"}
                  {delta !== null && delta !== 0 ? (
                    <Sub className={delta > 0 ? "text-gain" : "text-loss"}>
                      {delta > 0 ? "+" : ""}
                      {delta} pts
                    </Sub>
                  ) : null}
                </Td>
                <Td
                  tight
                  className={
                    h.signals.sinceEntry === null
                      ? "text-ink-subtle"
                      : moveTone(h.signals.sinceEntry) === "gain"
                        ? "text-gain"
                        : moveTone(h.signals.sinceEntry) === "loss"
                          ? "text-loss"
                          : "text-ink"
                  }
                >
                  {h.signals.sinceEntry === null ? "—" : formatPercent(h.signals.sinceEntry, 1)}
                </Td>
                <Td tight className="text-ink-muted">
                  {h.plan && (h.plan.target !== null || h.plan.stop !== null)
                    ? `${h.plan.target === null ? "—" : formatPercent(h.plan.target, 0)} / ${
                        h.plan.stop === null ? "—" : formatPercent(h.plan.stop, 0)
                      }`
                    : "—"}
                  {state ? (
                    <Sub>
                      <Badge tone={state.tone}>{state.label}</Badge>
                    </Sub>
                  ) : null}
                </Td>
                <Td align="left" tight>
                  {h.briefFit.status === "not_in_brief" ? (
                    <span className="text-ink-subtle">—</span>
                  ) : (
                    <Badge tone={FIT_TONE[h.briefFit.status]}>
                      {FIT_WORD[h.briefFit.status].replace(" the brief", "").replace(" from", "")}
                    </Badge>
                  )}
                </Td>
                <Td align="left" last tight>
                  {h.replacement ? (
                    <SymbolLink
                      symbol={h.replacement.symbol}
                      exchange={h.replacement.exchange}
                      className="font-mono text-ink"
                    />
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </section>
  );
}

// --- the conversation ----------------------------------------------------------

const SUGGESTIONS = [
  "What changed since your last run?",
  "Is this basket still doing what its brief says?",
  "What is the biggest risk in this basket?",
];

function Conversation({ run, analyst }: { run: RunRecord; analyst: UseAnalyst }) {
  const end = useRef<HTMLDivElement>(null);
  const { asking, askError, canAsk, ask, needsKey, prices } = analyst;

  useEffect(() => {
    if (asking) end.current?.scrollIntoView({ block: "nearest" });
  }, [asking, run.exchanges.length]);

  const blocked = needsKey
    ? "Questions need an OpenAI key — see the New run pane."
    : !canAsk
      ? prices.status === "error"
        ? "Prices did not load, and I need them to answer."
        : "Loading prices so I can answer…"
      : null;

  return (
    <section>
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-body font-semibold tracking-tight text-ink">Questions on this run</h3>
        <p className="mt-0.5 text-detail text-ink-muted">
          Challenge a call or ask why. Questions and answers are saved with the run, and later runs
          built on it read them.
        </p>
      </div>

      {run.exchanges.map((x, i) => (
        <div key={`${x.at}-${i}`} className="border-t border-line">
          <div className="bg-sunken px-6 py-3">
            <div className="text-meta font-medium tracking-wide text-ink-subtle">
              You · {formatDate(x.at)} {formatClock(x.at)}
            </div>
            <p className="mt-1 max-w-[72ch] text-detail leading-relaxed text-ink">{x.question}</p>
          </div>
          <div className="px-6 py-3">
            <div className="text-meta font-medium tracking-wide text-accent-ink">Analyst</div>
            <Prose className="mt-1 max-w-[72ch]" text={x.answer} />
          </div>
        </div>
      ))}

      {asking ? (
        <div className="border-t border-line">
          <div className="bg-sunken px-6 py-3">
            <div className="text-meta font-medium tracking-wide text-ink-subtle">You</div>
            <p className="mt-1 text-detail leading-relaxed text-ink">{asking}</p>
          </div>
          <div className="space-y-1.5 px-6 py-3" role="status">
            <div className="text-meta font-medium tracking-wide text-accent-ink">Analyst</div>
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ) : null}

      {askError ? <p className="border-t border-line bg-loss-soft px-6 py-2.5 text-detail text-loss">{askError}</p> : null}
      <div ref={end} />

      <Composer
        onAsk={ask}
        disabled={Boolean(asking) || !canAsk}
        blocked={blocked}
        suggest={run.exchanges.length === 0}
      />
    </section>
  );
}

function Composer({
  onAsk,
  disabled,
  blocked,
  suggest,
}: {
  onAsk: (q: string) => void;
  disabled: boolean;
  blocked: string | null;
  suggest: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onAsk(text);
    setValue("");
  }

  return (
    <div className="border-t border-line bg-sunken px-6 py-4">
      {suggest ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => onAsk(s)}
              className="rounded-md border border-line bg-canvas px-2 py-1 text-meta text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex max-w-3xl items-end gap-2">
        <textarea
          rows={2}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          // Enter sends, shift-Enter breaks the line.
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Challenge a call, or ask why…"
          className="min-h-16 w-full resize-none rounded-md border border-line-strong bg-surface px-3 py-2 text-detail text-ink outline-none transition placeholder:text-ink-subtle focus:border-accent disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="rounded-md bg-accent px-3 py-2 text-detail font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-40"
        >
          Ask
        </button>
      </div>
      {blocked ? <p className="mt-2 text-meta text-ink-subtle">{blocked}</p> : null}
    </div>
  );
}
