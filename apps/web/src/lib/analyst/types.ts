/**
 * The shapes the watchlist analyst works in.
 *
 * Two rules carry through the whole module, both borrowed from
 * `lib/watchlist/pnl.ts` because the analyst sits on top of the same feed:
 *
 * 1. **A figure nobody could compute is `null`, never `0`.** The agent is
 *    allowed to say "I can't price this" — it is not allowed to say "flat" when
 *    it means "unknown", because a verdict resting on a fabricated zero is
 *    worse than no verdict.
 * 2. **Every verdict carries the findings it was derived from.** A `Review` is
 *    not a score with a sentence attached; the sentence *is* the score, read
 *    back. That is what lets the agent be questioned, and what gets written to
 *    the memo so the next review can argue with this one.
 */

import type { AgentInputItem } from "@openai/agents-core";
import type { Tone } from "@/lib/types";

/** What the agent thinks you should do with a holding. */
export type Verdict = "keep" | "add" | "trim" | "sell";

/** Which way a finding pushed the score. */
export type Pull = "for" | "against" | "context";

/** Where a finding's claim comes from. Only the first two may carry weight. */
export type Basis = "measured" | "reported" | "holder";

/**
 * One reason, in the agent's own words, with the number behind it.
 *
 * `weight` is the signed contribution this finding made to the holding's score,
 * in score points — so a reader can add the findings up and land on the score,
 * and the agent can honestly answer "how much did that actually matter?".
 */
export interface Finding {
  /** Stable id, so a question can name one finding: "momentum", "trend". */
  id: string;
  label: string;
  /** The sentence shown to the reader. Written to be read on its own. */
  detail: string;
  /**
   * What the claim rests on: a figure from a tool, something the agent read and
   * cited, or something the holder told it. `holder` findings are always weighted
   * zero — see the note in `agent.ts`.
   */
  basis: Basis;
  pull: Pull;
  /** Signed score points. `context` findings carry 0 and only explain. */
  weight: number;
  /**
   * A pre-formatted measurement, when the finding came from one. Empty for a
   * finding the model wrote: the card shows measured quantities from `quant.ts`
   * beside it, so nothing unverified is ever presented as a figure.
   */
  value: string;
}

/**
 * One page the agent read.
 *
 * Kept per holding rather than per finding: a reader checking "is the order book
 * claim real?" wants the two or three pages behind that holding's case, not a
 * footnote marker system.
 */
export interface Source {
  title: string;
  url: string;
  published: string | null;
}

/** The measurements a verdict is computed from. All nullable: history is thin. */
export interface Signals {
  /** The price the verdict was struck at — live quote, else the last close. */
  price: number | null;
  /** Trailing total return on adjusted closes. */
  ret1m: number | null;
  ret3m: number | null;
  ret6m: number | null;
  /** Return from the ledger's entry price, not from a bar. */
  sinceEntry: number | null;
  /** Position relative to its own averages, as a fraction: +0.04 is 4% above. */
  vsSma50: number | null;
  vsSma200: number | null;
  /** 50-day average above the 200-day — the slow trend's sign. */
  trendUp: boolean | null;
  /** Drawdown from the highest adjusted close in the window, as a negative. */
  fromHigh: number | null;
  /** Annualised volatility of daily returns. */
  vol: number | null;
  /** 3-month return less the benchmark's — the only relative figure here. */
  rs3m: number | null;
  /** Bars actually used, so a thin series can be disclosed rather than hidden. */
  bars: number;
}

/** How a holding sits against the basket's brief. */
export type BriefFit = "fits" | "drifting" | "breaks" | "not_in_brief";

/** How the basket as a whole is doing against what its brief says it is for. */
export type ThesisStatus = "on_track" | "mixed" | "off_track" | "no_brief";

export interface ThesisCheck {
  status: ThesisStatus;
  /** Two or three sentences. Empty when there was no brief to judge against. */
  assessment: string;
}

/** One holding, reviewed. */
export interface HoldingReview {
  /** `NSE:RELIANCE` — the key the UI renders instruments by. */
  key: string;
  symbol: string;
  exchange: string;
  name: string | null;
  sector: string;
  quantity: number;
  /** When the position was opened, for the card's "held since". */
  entryAt: string | null;
  /** Market value, for weighting the roll-up. */
  value: number | null;
  weight: number | null;
  /** As measured when the run was made — a stored run keeps the figures it argued from. */
  signals: Signals;
  /** The deterministic composite from `quant.ts` — the prior the model was given. */
  screen: number;
  /** The model's own conviction, 0–100. It may differ from the screen, and says why. */
  score: number;
  /** One sentence: the call and its strongest reason. */
  headline: string;
  confidence: "high" | "medium" | "low";
  verdict: Verdict;
  findings: Finding[];
  /** Set on `trim` and `sell` when a better-scoring name was found. */
  replacement: Replacement | null;
  /** Why cash beats the bench, on a sell or trim the agent named no swap for. */
  cashInstead: string | null;
  /**
   * What the price does not show yet — news, launches, orders, guidance — and what
   * it implies. Null when the agent searched and found nothing material.
   */
  outlook: string | null;
  /** The pages the outlook rests on, so a reader can check the claim. */
  sources: Source[];
  /** What the agent said about this symbol in the newest run it was given as context. */
  previous: { verdict: Verdict; score: number; at: string } | null;
  /** The agent's reading of this holding against the brief. */
  briefFit: { status: BriefFit; note: string };
  /** What the brief planned for this holding, copied in so the run shows what it was judged against. */
  plan: { role: string; target: number | null; stop: number | null } | null;
}

export interface Replacement {
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  score: number;
  /** Score points the candidate beats the held name by. */
  edge: number;
  signals: Signals;
  /** Why this one, in a sentence. */
  rationale: string;
}

/** A name worth adding to the basket — not as a swap, as a new position. */
export interface Addition {
  symbol: string;
  exchange: string;
  name: string;
  sector: string;
  score: number;
  signals: Signals;
  rationale: string;
}

/**
 * The whole basket, reviewed — what a run stores and the page renders.
 *
 * Deliberately free of the model conversation: a report is the record of what
 * was advised, and it has to render the same in a year as it did today.
 */
export interface Report {
  at: string;
  /** The benchmark's own state, because every verdict is read against it. */
  regime: Regime;
  holdings: HoldingReview[];
  /** Sector weights by market value, for the concentration finding. */
  sectors: Array<{ sector: string; weight: number }>;
  /** The two or three sentences the agent leads with. */
  summary: string;
  counts: Record<Verdict, number>;
  /** Symbols the feed had no usable history for — excluded, and said so. */
  skipped: string[];
  /** Held symbols with no sector on file. Never rendered as an exposure. */
  unclassified: string[];
  thesis: ThesisCheck;
  additions: Addition[];
}

export interface Regime {
  label: string;
  /** NIFTY 50 above its own 200-day average. */
  trendUp: boolean | null;
  ret3m: number | null;
  tone: Tone;
}

// --- runs --------------------------------------------------------------------

/** One follow-up question asked of a run, and the answer. */
export interface Exchange {
  at: string;
  question: string;
  answer: string;
}

/** A run as the run list shows it. */
export interface RunSummary {
  id: string;
  basketId: string;
  seq: number;
  /** `r3` — the handle a run is cited by. */
  label: string;
  at: string;
  model: string | null;
  summary: string;
  counts: Record<Verdict, number>;
  /** The earlier runs this one was given as context. */
  contextRunIds: string[];
}

/** One run in full. */
export interface RunRecord extends RunSummary {
  report: Report;
  markdown: string;
  /** The brief exactly as the agent read it; null when it was not given one. */
  briefMarkdown: string | null;
  exchanges: Exchange[];
  /**
   * The model's conversation after the run.
   *
   * A follow-up continues from here, so the agent defends the verdicts it
   * actually reached rather than re-deriving them from a summary. Null when the
   * run was loaded without it.
   */
  conversation: AgentInputItem[] | null;
}

/**
 * An earlier run, as the next run is given it.
 *
 * This is the state the next run reads: enough to say "I told you to trim this
 * in March and you still hold it", and nothing more.
 */
export interface PriorRun {
  id: string;
  label: string;
  at: string;
  regime: string;
  summary: string;
  thesis: ThesisCheck;
  verdicts: Array<{
    symbol: string;
    verdict: Verdict;
    score: number;
    /** The single strongest reason, so the record says *why*, not just what. */
    reason: string;
    replacement: string | null;
    sinceEntry: number | null;
    /**
     * What the agent believed was coming. Kept because a forward-looking claim is
     * the part of a review that can be checked later.
     */
    outlook: string | null;
    briefFit: { status: BriefFit; note: string };
  }>;
  additions: string[];
  /** What the user put to that run. Arguments, not small talk. */
  exchanges: Exchange[];
}
