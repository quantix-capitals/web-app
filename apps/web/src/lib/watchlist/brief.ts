/**
 * A basket's brief: why it exists, how it was built, how long it is meant to
 * run, and the case for and against each holding in it.
 *
 * **Why a brief at all.** A basket is a dated list of symbols, and a list of
 * symbols does not say what it is *for*. "Sell HDFCBANK, momentum has rolled
 * over" is good advice for a three-month momentum basket and bad advice for a
 * ten-year compounding one — the analyst cannot tell the two apart unless
 * someone wrote down which one this is. The brief is that record, and it goes
 * into every analyst run by default.
 *
 * **Who writes it.** Whoever struck the basket: a person in the new-basket form,
 * the agent when it drafts one, or an algorithm that builds baskets in code
 * (`createBasket({ origin: "algorithm", brief })`). `author` records which.
 *
 * **Why structured *and* markdown.** The structured object is what the editor
 * edits and what the tools compute from — a target of `0.2` can be checked
 * against the measured return since entry, which a sentence cannot. The markdown
 * is rendered from that object in the same write, and it is what the agent reads
 * and what a download hands over. One source, two readings, same rule as the
 * analyst's reports.
 */

import { formatDate, formatPercent } from "@/lib/format";
import type { ListOrigin } from "@/lib/types";

export interface BriefHolding {
  /** Ticker as held, e.g. `RELIANCE`. */
  symbol: string;
  /** What the name is doing in the basket: "core compounder", "cyclical kicker". */
  role: string;
  /** The case, in a sentence or two. */
  thesis: string;
  /** What argues for it — each a short, checkable claim. */
  pluses: string[];
  /** What argues against it, or would go wrong. */
  minuses: string[];
  /** Expected upside from entry that would count as the thesis playing out, as a fraction: 0.2 is +20%. */
  target: number | null;
  /** The loss from entry at which the thesis is considered broken, as a negative fraction: -0.1 is −10%. */
  stop: number | null;
}

export interface Brief {
  version: 1;
  /** Why this basket exists — the question it is answering. */
  motive: string;
  /** How it was built: the screen, the reasoning, the source of the names. */
  method: string;
  /** How long the thesis is meant to take to play out. */
  horizonMonths: number | null;
  /** An explicit date to judge it by, when there is one. ISO date. */
  reviewBy: string | null;
  /** What "it worked" looks like at the end of the horizon. */
  success: string;
  /** What would prove the basket's thesis wrong before then. */
  invalidation: string;
  /** Where replacements and additions should come from. Empty means anywhere. */
  sectors: string[];
  holdings: BriefHolding[];
  /** Anything else, in free markdown. */
  notes: string;
}

export type BriefAuthor = ListOrigin;

/** A brief as stored against a basket. */
export interface StoredBrief {
  basketId: string;
  author: BriefAuthor;
  content: Brief;
  markdown: string;
  createdAt: string;
  updatedAt: string;
}

export function emptyBrief(): Brief {
  return {
    version: 1,
    motive: "",
    method: "",
    horizonMonths: null,
    reviewBy: null,
    success: "",
    invalidation: "",
    sectors: [],
    holdings: [],
    notes: "",
  };
}

export function emptyHolding(symbol: string): BriefHolding {
  return { symbol, role: "", thesis: "", pluses: [], minuses: [], target: null, stop: null };
}

/**
 * A stored or model-written brief, coerced into shape.
 *
 * Every field is checked rather than cast: `content` is jsonb that an algorithm
 * outside this app may have written, and one missing array should cost that
 * field, not crash the basket page.
 */
export function normalizeBrief(raw: unknown): Brief {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];

  return {
    version: 1,
    motive: text(r.motive),
    method: text(r.method),
    horizonMonths: num(r.horizonMonths),
    reviewBy: typeof r.reviewBy === "string" && r.reviewBy ? r.reviewBy : null,
    success: text(r.success),
    invalidation: text(r.invalidation),
    sectors: list(r.sectors),
    holdings: Array.isArray(r.holdings)
      ? r.holdings
          .filter((h): h is Record<string, unknown> => Boolean(h) && typeof h === "object")
          .filter((h) => typeof h.symbol === "string" && h.symbol.trim() !== "")
          .map((h) => ({
            symbol: String(h.symbol).trim().toUpperCase(),
            role: text(h.role),
            thesis: text(h.thesis),
            pluses: list(h.pluses),
            minuses: list(h.minuses),
            target: num(h.target),
            // A stop is a loss. Written as "10" or "0.1" by a person or a script, it
            // still means "down ten percent", so the sign is forced.
            stop: num(h.stop) === null ? null : -Math.abs(num(h.stop)!),
          }))
      : [],
    notes: text(r.notes),
  };
}

/** Whether a brief says anything at all. An empty one is not sent to the agent. */
export function isBriefEmpty(brief: Brief): boolean {
  return (
    !brief.motive.trim() &&
    !brief.method.trim() &&
    brief.horizonMonths === null &&
    !brief.reviewBy &&
    !brief.success.trim() &&
    !brief.invalidation.trim() &&
    !brief.sectors.length &&
    !brief.notes.trim() &&
    brief.holdings.every(
      (h) =>
        !h.role.trim() &&
        !h.thesis.trim() &&
        !h.pluses.length &&
        !h.minuses.length &&
        h.target === null &&
        h.stop === null,
    )
  );
}

export function briefHolding(brief: Brief | null, symbol: string): BriefHolding | null {
  if (!brief) return null;
  return brief.holdings.find((h) => h.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
}

/**
 * When the basket is meant to be judged: the explicit date if one was given,
 * else the struck date plus the horizon. Null when neither is known.
 */
export function horizonEnd(brief: Brief, struck: string): string | null {
  if (brief.reviewBy) return brief.reviewBy;
  if (brief.horizonMonths === null) return null;
  const end = new Date(struck);
  end.setMonth(end.getMonth() + brief.horizonMonths);
  return end.toISOString().slice(0, 10);
}

/** How far through its horizon the basket is, 0–1. Null when there is no horizon. */
export function horizonProgress(brief: Brief, struck: string, now = new Date()): number | null {
  const end = horizonEnd(brief, struck);
  if (!end) return null;
  const start = new Date(struck).getTime();
  const span = new Date(end).getTime() - start;
  if (!(span > 0)) return null;
  return Math.max(0, Math.min(1, (now.getTime() - start) / span));
}

const AUTHOR_WORD: Record<BriefAuthor, string> = {
  user: "a person",
  agent: "the analyst agent",
  algorithm: "an algorithm",
};

export function authorLabel(author: BriefAuthor): string {
  return AUTHOR_WORD[author] ?? author;
}

/** Table-cell safe: a pipe or a newline would break the row. */
function cell(text: string): string {
  return text.replace(/\|/g, "/").replace(/\s*\n+\s*/g, " ").trim() || "—";
}

/**
 * The brief as a markdown document.
 *
 * Section order follows the questions the analyst is told to ask of it: why,
 * how, until when, what counts as working, what counts as broken, then the
 * holdings one by one. Empty sections are left out rather than printed as
 * "—", so a thin brief reads as thin rather than as a form nobody filled in.
 */
export function renderBriefMarkdown(
  brief: Brief,
  meta: { name: string; struck: string; author: BriefAuthor },
): string {
  const out: string[] = [];
  out.push(`# ${meta.name} — brief`);
  out.push(`*Written by ${authorLabel(meta.author)} · basket struck ${formatDate(meta.struck)}*`);

  if (brief.motive.trim()) out.push(`## Why this basket exists\n\n${brief.motive.trim()}`);
  if (brief.method.trim()) out.push(`## How it was built\n\n${brief.method.trim()}`);

  const end = horizonEnd(brief, meta.struck);
  const timeline: string[] = [`- Struck: ${formatDate(meta.struck)}`];
  if (brief.horizonMonths !== null) {
    timeline.push(`- Horizon: ${brief.horizonMonths} ${brief.horizonMonths === 1 ? "month" : "months"}`);
  }
  if (end) timeline.push(`- Judge it by: ${formatDate(end)}`);
  if (timeline.length > 1) out.push(`## Timeline\n\n${timeline.join("\n")}`);

  if (brief.success.trim()) out.push(`## What working looks like\n\n${brief.success.trim()}`);
  if (brief.invalidation.trim()) {
    out.push(`## What would prove it wrong\n\n${brief.invalidation.trim()}`);
  }
  if (brief.sectors.length) {
    out.push(`## Where ideas should come from\n\n${brief.sectors.join(", ")}`);
  }

  const described = brief.holdings.filter(
    (h) => h.role || h.thesis || h.pluses.length || h.minuses.length || h.target !== null || h.stop !== null,
  );
  if (described.length) {
    const table = [
      "| Symbol | Role | Target | Stop | Pluses | Minuses |",
      "| --- | --- | ---: | ---: | ---: | ---: |",
      ...described.map(
        (h) =>
          `| ${h.symbol} | ${cell(h.role)} | ${h.target === null ? "—" : formatPercent(h.target, 0)} | ${
            h.stop === null ? "—" : formatPercent(h.stop, 0)
          } | ${h.pluses.length} | ${h.minuses.length} |`,
      ),
    ].join("\n");

    const detail = described.map((h) => {
      const lines = [`### ${h.symbol}${h.role ? ` — ${h.role}` : ""}`];
      if (h.thesis.trim()) lines.push(h.thesis.trim());
      if (h.pluses.length) lines.push(["**Pluses**", ...h.pluses.map((p) => `- ${p}`)].join("\n"));
      if (h.minuses.length) lines.push(["**Minuses**", ...h.minuses.map((m) => `- ${m}`)].join("\n"));
      return lines.join("\n\n");
    });

    out.push(["## Holdings", table, ...detail].join("\n\n"));
  }

  if (brief.notes.trim()) out.push(`## Notes\n\n${brief.notes.trim()}`);

  return out.join("\n\n") + "\n";
}
