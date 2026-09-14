/**
 * One holding's call, with the reasoning folded behind it.
 *
 * The row says four things without being opened — the ticker, the verdict, the
 * score, and what to buy instead — because those are what you would act on, and
 * a panel that makes you expand nine rows to find the one sell is a panel nobody
 * reads twice. Everything that *justifies* the call sits one click down.
 *
 * Colour carries the verdict, and never carries it alone: the word is always
 * written out. A reader who cannot tell the red badge from the green one still
 * sees "Sell".
 */

import { useState } from "react";
import { Badge, Meter, SymbolLink } from "@/components/ui/primitives";
import { cn, formatLevelPercent, formatMoney, formatPercent } from "@/lib/format";
import type { Tone } from "@/lib/types";
import type { Basis, BriefFit, Finding, HoldingReview, Source, Verdict } from "@/lib/analyst/types";
import { FIT_WORD } from "@/lib/analyst/report";
import { IconChevron } from "@/components/shell/nav-icons";
import { RichText } from "./prose";

const VERDICT: Record<Verdict, { label: string; tone: Tone }> = {
  add: { label: "Add", tone: "gain" },
  keep: { label: "Keep", tone: "gain" },
  trim: { label: "Trim", tone: "warn" },
  sell: { label: "Sell", tone: "loss" },
};

export function VerdictCard({
  holding,
  onAsk,
}: {
  holding: HoldingReview;
  onAsk: (question: string) => void;
}) {
  // Anything needing action opens by default. The reasoning behind a "keep" is
  // available but not in the way; the reasoning behind a "sell" is the point.
  const [open, setOpen] = useState(holding.verdict === "sell");
  const verdict = VERDICT[holding.verdict];
  const changed = holding.previous && holding.previous.verdict !== holding.verdict;

  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-sunken"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-body font-medium tracking-tight text-ink">
              {holding.symbol}
            </span>
            <Badge tone={verdict.tone}>{verdict.label}</Badge>
            {changed ? <Badge tone="info">Changed</Badge> : null}
            {holding.briefFit.status === "breaks" || holding.briefFit.status === "drifting" ? (
              <Badge tone={FIT_TONE[holding.briefFit.status]}>{FIT_WORD[holding.briefFit.status]}</Badge>
            ) : null}
          </div>

          {/* Two numbers, because they answer different questions: the agent's
              conviction, and the mechanical screen it was handed as a prior. A gap
              between them is the interesting case, and it is the one the chat is
              for. */}
          <div className="mt-2 flex items-center gap-2">
            <Meter
              value={holding.score}
              tone={verdict.tone}
              label={`${holding.symbol} conviction`}
              className="max-w-32"
            />
            <span className="text-meta tabular-nums text-ink-muted">{holding.score}</span>
            <span
              className="text-meta tabular-nums text-ink-subtle"
              title="The deterministic screen score the agent was given as a starting point"
            >
              screen {holding.screen}
            </span>
          </div>

          <p className="mt-1.5 text-detail leading-relaxed text-ink-muted">
            <RichText text={holding.headline} />
          </p>

          <p className="mt-1 text-meta text-ink-subtle">
            {holding.signals.sinceEntry === null
              ? "No entry price on record"
              : `${formatPercent(holding.signals.sinceEntry)} since entry`}
            {holding.weight === null ? "" : ` · ${formatLevelPercent(holding.weight)} of basket`}
            {holding.replacement ? ` · buy ${holding.replacement.symbol} instead` : ""}
          </p>
        </div>

        <IconChevron
          className={cn(
            "mt-1 size-4 shrink-0 text-ink-subtle transition-transform",
            open ? "rotate-90" : "-rotate-90",
          )}
        />
      </button>

      {open ? (
        <div className="space-y-3 px-4 pb-4">
          <Measured holding={holding} />
          {holding.plan || holding.briefFit.note ? <AgainstBrief holding={holding} /> : null}
          <Reasons findings={holding.findings} />

          {holding.replacement ? (
            <Swap holding={holding} />
          ) : holding.cashInstead ? (
            <p className="border-l-2 border-line-strong pl-3 text-detail leading-relaxed text-ink-muted">
              {holding.cashInstead}
            </p>
          ) : null}

          {holding.outlook ? <Outlook text={holding.outlook} sources={holding.sources} /> : null}

          {holding.previous ? (
            <p className="text-meta leading-relaxed text-ink-subtle">
              Last run given as context: {holding.previous.verdict} at {holding.previous.score} on{" "}
              {holding.previous.at.slice(0, 10)}.
              {changed ? " I have changed my mind since." : " Unchanged."}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button
              type="button"
              onClick={() => onAsk(`Why ${holding.verdict} ${holding.symbol}? Give me the full case.`)}
              className="text-meta font-medium text-accent-ink underline underline-offset-2"
            >
              Ask for the full case
            </button>
            <button
              type="button"
              onClick={() =>
                onAsk(
                  `Make the opposite case on ${holding.symbol}. What would have to be true for you to be wrong?`,
                )
              }
              className="text-meta font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
            >
              Challenge it
            </button>
            <span className="text-meta text-ink-subtle">
              {holding.confidence} confidence · {holding.signals.bars} bars
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const FIT_TONE: Record<BriefFit, Tone> = {
  fits: "gain",
  drifting: "warn",
  breaks: "loss",
  not_in_brief: "neutral",
};

/**
 * The holding against its brief: the role it was given, the target and stop it
 * was set, and the analyst's one-sentence reading of where it now stands.
 */
function AgainstBrief({ holding }: { holding: HoldingReview }) {
  const { plan, briefFit } = holding;
  return (
    <div className="border-l-2 border-accent-line pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-meta font-medium tracking-wide text-accent-ink">Against the brief</span>
        <Badge tone={FIT_TONE[briefFit.status]}>{FIT_WORD[briefFit.status]}</Badge>
      </div>
      {plan ? (
        <p className="mt-1 text-meta text-ink-subtle">
          {plan.role ? `${plan.role} · ` : ""}target{" "}
          {plan.target === null ? "not set" : formatPercent(plan.target, 0)} · stop{" "}
          {plan.stop === null ? "not set" : formatPercent(plan.stop, 0)}
        </p>
      ) : null}
      {briefFit.note ? (
        <p className="mt-1 text-detail leading-relaxed text-ink-muted">
          <RichText text={briefFit.note} />
        </p>
      ) : null}
    </div>
  );
}

/**
 * What the price does not show yet, and the pages it came from.
 *
 * Set apart from the findings above because it is a different kind of claim.
 * Everything above is measured from bars this app fetched; this is reported by
 * someone else, and the links are here so the reader can go and check rather
 * than take the agent's word for it. A dated source reads as evidence; an
 * undated one reads as a rumour, so the date is shown whenever the page gave one.
 */
function Outlook({ text, sources }: { text: string; sources: Source[] }) {
  return (
    <div className="border-l-2 border-info pl-3">
      <div className="text-meta font-medium tracking-wide text-info">What is coming</div>
      <p className="mt-1 text-detail leading-relaxed text-ink-muted">
        <RichText text={text} />
      </p>
      {sources.length ? (
        <ul className="mt-1.5 space-y-1">
          {sources.map((source) => (
            <li key={source.url} className="text-meta leading-relaxed">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-ink underline-offset-2 hover:underline"
              >
                {source.title}
              </a>
              {source.published ? (
                <span className="text-ink-subtle"> · {source.published}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-meta text-ink-subtle">No source given for this.</p>
      )}
    </div>
  );
}

/**
 * The measurements, as the app computed them.
 *
 * This strip is here because the reasoning above it is the model's prose, and
 * prose is the wrong place to read a figure off. These come from `quant.ts` — the
 * same arithmetic, on the same bars and the same live quote, that the table on
 * the left is built from. If the agent's sentence and this strip ever disagree,
 * believe the strip.
 */
function Measured({ holding }: { holding: HoldingReview }) {
  const s = holding.signals;
  const rows: Array<[string, string]> = [
    ["3-month", s.ret3m === null ? "—" : formatPercent(s.ret3m)],
    ["vs NIFTY", s.rs3m === null ? "—" : formatPercent(s.rs3m)],
    ["vs 200-day", s.vsSma200 === null ? "—" : formatPercent(s.vsSma200)],
    ["Off high", s.fromHigh === null ? "—" : formatPercent(s.fromHigh)],
    ["Volatility", s.vol === null ? "—" : formatLevelPercent(s.vol)],
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-y border-line py-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-2">
          <dt className="text-meta text-ink-subtle">{label}</dt>
          <dd className="text-meta tabular-nums text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Where a claim came from, in one word.
 *
 * Shown on every finding because the three are not equally good, and the reader
 * is entitled to know which one they are being asked to act on: a measurement
 * this app computed, something the agent read somewhere, or something the reader
 * told it themselves. The last of those can never carry weight — see `agent.ts`.
 */
const BASIS: Record<Basis, { label: string; className: string }> = {
  measured: { label: "measured", className: "text-ink-subtle" },
  reported: { label: "reported", className: "text-info" },
  holder: { label: "you told me", className: "text-warn" },
};

/**
 * The findings, grouped by which way they pulled.
 *
 * Each carries the weight the agent itself put on it, so "why 41 and not 60?" has
 * an answer on screen rather than in a tooltip. The weights are the model's own
 * account of its reasoning — they are not a recomputation of it.
 */
function Reasons({ findings }: { findings: Finding[] }) {
  const groups: Array<{ title: string; items: Finding[]; tone: string }> = [
    { title: "For", items: findings.filter((f) => f.pull === "for"), tone: "text-gain" },
    { title: "Against", items: findings.filter((f) => f.pull === "against"), tone: "text-loss" },
    {
      title: "Context, unscored",
      items: findings.filter((f) => f.pull === "context"),
      tone: "text-ink-subtle",
    },
  ];

  return (
    <div className="space-y-3">
      {groups
        .filter((g) => g.items.length)
        .map((group) => (
          <div key={group.title}>
            <div className={cn("text-meta font-medium tracking-wide", group.tone)}>
              {group.title}
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {group.items.map((f) => (
                <li key={f.id} className="text-detail leading-relaxed text-ink-muted">
                  <span className="font-medium text-ink">{f.label}</span>{" "}
                  <span className={cn("text-meta", BASIS[f.basis].className)}>
                    {BASIS[f.basis].label}
                  </span>{" "}
                  {f.value || f.weight !== 0 ? (
                    <span className="tabular-nums text-ink-subtle">
                      {f.value}
                      {f.weight !== 0
                        ? `${f.value ? " · " : ""}${f.weight > 0 ? "+" : ""}${f.weight} pts`
                        : ""}
                    </span>
                  ) : null}
                  <br />
                  <RichText text={f.detail} />
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

function Swap({ holding }: { holding: HoldingReview }) {
  const swap = holding.replacement!;
  return (
    <div className="border-l-2 border-accent pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-meta font-medium tracking-wide text-accent-ink">Instead buy</span>
        <SymbolLink
          symbol={swap.symbol}
          exchange={swap.exchange}
          className="font-mono text-body font-medium text-ink"
        />
        <Badge tone="accent">+{swap.edge} pts</Badge>
      </div>
      <p className="mt-1 text-detail leading-relaxed text-ink-muted">
        {swap.name} · {swap.sector}. <RichText text={swap.rationale} />
      </p>
      {holding.value !== null ? (
        <p className="mt-1 text-meta text-ink-subtle">
          Roughly {formatMoney(holding.value)} to move, before costs and tax.
        </p>
      ) : null}
    </div>
  );
}
