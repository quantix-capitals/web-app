/**
 * The agent's tools: the only way the model can reach a number.
 *
 * Nothing here fetches. The book is measured before the run starts — one history
 * request, the shared quote poll — and these tools read that snapshot, so a run
 * cannot be slow because the model called a tool twice, and every tool result is
 * consistent with every other one within a run. Tools are how the model *asks*,
 * not how the app loads.
 *
 * The brief and the earlier runs are not tools. They are put straight into the
 * run's opening message (`agent.ts`), because they are the frame every call is
 * made in, and a frame the model has to remember to ask for is one it will
 * sometimes skip. What the tools add is the arithmetic on top of the brief: the
 * target and stop it states, checked against the measured return since entry.
 *
 * Two design rules worth keeping if this moves to `apps/agent`:
 *
 * - **Tool results are pre-formatted facts.** Percentages arrive as "14.2%", not
 *   as 0.142, formatted by the same helpers the tables use. A model handed raw
 *   floats will eventually print one at the wrong scale, and it will look exactly
 *   like a number the app computed.
 * - **Tools never carry an opinion.** No tool returns "weak" or "overbought".
 *   The screen score is the one composite, and it is labelled a prior in the
 *   prompt. If the model's case rests on a judgement, the judgement is the
 *   model's and is open to challenge; that is the whole point of the panel.
 */

import { tool } from "@openai/agents-core";
import { z } from "zod";
import { formatDate, formatLevelPercent, formatMoney, formatPercent } from "@/lib/format";
import { briefHolding, type Brief } from "@/lib/watchlist/brief";
import type { Book, MeasuredCandidate, MeasuredHolding } from "./quant";
import { WEIGHTS } from "./quant";
import { UNCLASSIFIED } from "./sectors";
import type { PriorRun } from "./types";

/** What a run reads. One snapshot, fixed for the whole run. */
export interface AnalystContext {
  book: Book;
  /** The basket's brief, when there is one and the run was asked to use it. */
  brief: Brief | null;
  /** The same brief as the markdown the agent is shown. */
  briefMarkdown: string | null;
  /** True when a brief exists but the user chose to run without it. */
  briefOmitted: boolean;
  /** Earlier runs the user selected as context, newest first. */
  prior: PriorRun[];
}

/**
 * The brief's plan for one holding, checked against what was measured.
 *
 * The comparison is done here rather than left to the model: "is it through its
 * stop?" is arithmetic, and arithmetic is what tools are for.
 */
function planPayload(h: MeasuredHolding, brief: Brief | null) {
  if (!brief) return null;
  const plan = briefHolding(brief, h.symbol);
  if (!plan) {
    return "Not named in the brief — added after it was written, or never given a thesis.";
  }

  const since = h.signals.sinceEntry;
  let reading: string;
  if (plan.target === null && plan.stop === null) {
    reading = "The brief sets no target or stop for this holding.";
  } else if (since === null) {
    reading = "No entry price on record, so the brief's target and stop cannot be checked.";
  } else if (plan.target !== null && since >= plan.target) {
    reading = "At or past the brief's target.";
  } else if (plan.stop !== null && since <= plan.stop) {
    reading = "Through the brief's stop.";
  } else {
    reading = "Between the brief's stop and its target.";
  }

  return {
    role: plan.role || null,
    thesis: plan.thesis || null,
    target_from_entry: plan.target === null ? null : formatPercent(plan.target, 0),
    stop_from_entry: plan.stop === null ? null : formatPercent(plan.stop, 0),
    since_entry: since === null ? null : formatPercent(since),
    reading,
  };
}

function candidatePayload(c: MeasuredCandidate) {
  return {
    symbol: c.symbol,
    name: c.name,
    sector: c.sector,
    screen_score: c.screen,
    measurements: c.notes,
  };
}

export function analystTools(ctx: AnalystContext) {
  const holdings = () => ctx.book.holdings;

  const holdingPayload = (h: MeasuredHolding) => ({
    symbol: h.symbol,
    name: h.name,
    sector: h.sector === UNCLASSIFIED ? "unknown to us — do not treat as a sector" : h.sector,
    held_since: h.entryAt ? formatDate(h.entryAt) : null,
    quantity: h.quantity,
    value: h.value === null ? null : formatMoney(h.value),
    share_of_basket: h.weight === null ? null : formatLevelPercent(h.weight),
    screen_score: h.screen,
    confidence: h.confidence,
    measurements: h.notes,
    brief_plan: planPayload(h, ctx.brief),
  });

  /** How much of the basket's value the sector weights actually account for. */
  const classifiedWeight = () =>
    ctx.book.sectors.reduce((sum, s) => sum + s.weight, 0);

  const listHoldings = tool({
    name: "list_holdings",
    description:
      "The basket under review: its name, when it was struck, and every symbol in it collapsed " +
      "to one row per symbol, with its measurements, its share of the basket's value, the " +
      "screen score, and — when the basket has a brief — that holding's target and stop checked " +
      "against its return since entry. Call this first.",
    parameters: z.object({}),
    execute: async () => ({
      basket: {
        name: ctx.book.basket.name,
        description: ctx.book.basket.description,
        struck: formatDate(ctx.book.basket.struck),
      },
      as_of: ctx.book.asOf,
      market: ctx.book.regime.label,
      holdings: holdings().map(holdingPayload),
      sector_weights: {
        note:
          "Weights cover only the holdings whose sector is known, so they need not sum to 100%. " +
          "Symbols under `sector_unknown` are missing from our lookup table — that is a gap in " +
          "our reference data, NOT a sector and NOT an exposure. Never report it as concentration.",
        covers: formatLevelPercent(classifiedWeight()),
        by_sector: ctx.book.sectors.map((s) => ({
          sector: s.sector,
          weight: formatLevelPercent(s.weight),
        })),
        sector_unknown: ctx.book.unclassified,
      },
      not_judged_no_price_at_all: ctx.book.skipped,
    }),
  });

  const getHolding = tool({
    name: "get_holding",
    description:
      "One holding in this basket in full, including every measurement, the holder's return " +
      "since entry, and the brief's plan for it. Use when a question is about a specific symbol.",
    parameters: z.object({
      symbol: z.string().describe("The NSE ticker, e.g. RELIANCE. Case-insensitive."),
    }),
    execute: async ({ symbol }) => {
      const found = holdings().find((h) => h.symbol.toUpperCase() === symbol.toUpperCase());
      if (!found) {
        return {
          error: `${symbol} is not in this basket, so it is not yours to advise on.`,
          symbols_available: holdings().map((h) => h.symbol),
        };
      }
      return holdingPayload(found);
    },
  });

  const screenAlternatives = tool({
    name: "screen_alternatives",
    description:
      "Liquid NSE large caps this basket does not already hold, ranked by screen score, for use " +
      "as replacements or additions. Filter by sector to hold the basket's exposure steady, or to " +
      "stay inside the sectors the brief names.",
    parameters: z.object({
      sector: z
        .string()
        .nullable()
        .describe("Restrict to one sector, e.g. Financials. Null for every sector."),
      limit: z.number().int().min(1).max(20).describe("How many to return. 5 is usually enough."),
    }),
    execute: async ({ sector, limit }) => {
      const pool = sector
        ? ctx.book.candidates.filter((c) => c.sector.toLowerCase() === sector.toLowerCase())
        : ctx.book.candidates;
      return {
        bench_note:
          "This bench is a hand-kept list of liquid NSE large caps, not a universe screen. Say so if you recommend from it.",
        sectors_available: [...new Set(ctx.book.candidates.map((c) => c.sector))],
        brief_sectors: ctx.brief?.sectors.length ? ctx.brief.sectors : null,
        candidates: pool.slice(0, limit).map(candidatePayload),
      };
    },
  });

  const getMarket = tool({
    name: "get_market_regime",
    description:
      "NIFTY 50's own trend and three-month return — the backdrop every holding should be read " +
      "against, and the scoring method behind the screen.",
    parameters: z.object({}),
    execute: async () => ({
      market: ctx.book.regime.label,
      index_above_its_long_average: ctx.book.regime.trendUp,
      index_three_month_return:
        ctx.book.regime.ret3m === null ? null : formatLevelPercent(ctx.book.regime.ret3m),
      screen_method: {
        description:
          "A transparent weighted composite over five measured factors, renormalised over whichever " +
          "factors could be measured. It is a prior, not a verdict.",
        weights: WEIGHTS,
        ignores:
          "The holder's entry price. What someone paid is a fact about their past, not about the stock's future.",
      },
    }),
  });

  return [listHoldings, getHolding, screenAlternatives, getMarket];
}
