/**
 * The watchlist analyst, built on the OpenAI Agents SDK.
 *
 * Three agents, one set of tools:
 *
 * - **The reviewer** returns a structured verdict per holding (`ReviewSchema`),
 *   which the page renders and `analyst-runs-service.ts` stores as a run.
 *   Structured output rather than prose because these verdicts are *data*: they
 *   are diffed against the last run, counted, charted and handed to the next run.
 * - **The respondent** answers follow-up questions on a run, in prose, carrying
 *   the conversation of the run it is defending.
 * - **The brief writer** drafts a basket's brief — why it exists, how long it is
 *   meant to run, the case for and against each holding — for a basket whose
 *   author never wrote one down.
 *
 * Every run opens with two things in its first message, not behind a tool: the
 * basket's brief, and the earlier runs the user ticked as context. They are the
 * frame every call is made in, and a frame the model has to remember to ask for
 * is one it will sometimes skip.
 *
 * The prompt is the product here, so the reasoning behind it belongs with it:
 *
 * 1. **Tools are the only source of numbers.** The model is told, flatly, never
 *    to state a figure a tool did not give it.
 * 2. **The screen score is a prior it may overrule** — and saying which
 *    measurement it is weighing differently when it does.
 * 3. **Entry price is reported and never scored.** Nor is a brief's target or
 *    stop: those are the author's plan, and a plan is scope, not evidence.
 * 4. **It must reach a decision.** Every holding gets one of four calls, and
 *    every sell or trim gets either a named replacement or a reason cash wins.
 * 5. **It judges the basket against its brief.** A momentum basket and a
 *    ten-year compounding basket holding the same stock deserve different advice.
 */

import { Agent, run, type AgentInputItem } from "@openai/agents-core";
import { webSearchTool } from "@openai/agents-openai";
import { z } from "zod";
import { normalizeBrief, briefHolding, type Brief, type BriefAuthor } from "@/lib/watchlist/brief";
import { MODEL } from "./client";
import { ensureClient } from "./runtime";
import { analystTools, type AnalystContext } from "./tools";
import type { Addition, HoldingReview, PriorRun, Report, Verdict } from "./types";
import type { Book } from "./quant";

// --- output ------------------------------------------------------------------

const FindingSchema = z.object({
  label: z
    .string()
    .describe("Two or three words naming the factor, e.g. 'Trend' or 'Off its high'."),
  detail: z.string().describe("One sentence a reader can act on, quoting the measurement."),
  basis: z
    .enum(["measured", "reported", "holder"])
    .describe(
      "Where this comes from. 'measured': a figure a tool gave you. 'reported': something you read " +
        "in a source, cited. 'holder': anything that came from the user or the brief — their horizon, " +
        "their thesis, their target or stop, their preference, their profit or loss. A 'holder' " +
        "finding is never evidence about the company and is always weighted 0.",
    ),
  pull: z
    .enum(["for", "against", "context"])
    .describe("Whether this argues for keeping, against keeping, or is unscored context."),
  weight: z
    .number()
    .int()
    .min(-40)
    .max(40)
    .describe("How much this moved your view, in points. 0 for context and for anything 'holder'."),
});

const SourceSchema = z.object({
  title: z.string().describe("The headline or page title, as published."),
  url: z.string().describe("The link you read it at."),
  published: z
    .string()
    .nullable()
    .describe("When it was published, as the page states it. Null if the page does not say."),
});

const HoldingSchema = z.object({
  symbol: z.string().describe("The ticker exactly as list_holdings gave it."),
  verdict: z.enum(["add", "keep", "trim", "sell"]),
  score: z.number().int().min(0).max(100).describe("Your conviction in the holding, 0-100."),
  headline: z.string().describe("One short sentence: the call and its single strongest reason."),
  findings: z.array(FindingSchema).min(2).max(7),
  replacement: z
    .object({
      symbol: z.string(),
      rationale: z
        .string()
        .describe("Why this one, including whether it holds or changes the sector exposure and whether it fits the brief."),
      edge: z.number().int().describe("How much better you think it is, in score points."),
    })
    .nullable()
    .describe("Required on sell and trim unless cash is genuinely the better answer."),
  cash_instead: z
    .string()
    .nullable()
    .describe("On a sell or trim with no replacement, say in one sentence why cash beats the bench."),
  outlook: z
    .string()
    .nullable()
    .describe(
      "What is happening at the company that the price does not show yet — recent news, product " +
        "launches, orders, guidance, regulation — and what it implies for the next few quarters. " +
        "Null when you searched and found nothing material, or did not search this name.",
    ),
  sources: z
    .array(SourceSchema)
    .describe("Every page the outlook and any news finding rests on. Empty when you did not search."),
  brief_fit: z
    .object({
      status: z
        .enum(["fits", "drifting", "breaks", "not_in_brief"])
        .describe(
          "'fits': the holding is still doing the job the brief gave it. 'drifting': the evidence is " +
            "moving against its role or its pluses. 'breaks': a minus the brief named has happened, " +
            "its stop is breached, or it no longer belongs in a basket with this motive. " +
            "'not_in_brief': there is no brief, or the brief says nothing about this holding.",
        ),
      note: z
        .string()
        .describe(
          "One sentence naming which plus or minus from the brief the evidence now supports, and " +
            "where the holding stands against its target and stop. Empty when not_in_brief.",
        ),
    }),
});

const ReviewSchema = z.object({
  summary: z
    .string()
    .describe("Two or three sentences: the state of the basket, what needs action, what changed."),
  thesis: z.object({
    status: z
      .enum(["on_track", "mixed", "off_track", "no_brief"])
      .describe("Is the basket doing what its brief says it is for, on the brief's timeline?"),
    assessment: z
      .string()
      .describe(
        "Two or three sentences: how far through its horizon the basket is, whether the success " +
          "criteria are being met, whether anything in 'what would prove it wrong' has happened, and " +
          "which holdings carry or break the thesis. Empty string when there is no brief.",
      ),
  }),
  holdings: z.array(HoldingSchema),
  additions: z
    .array(
      z.object({
        symbol: z.string().describe("A ticker from screen_alternatives."),
        rationale: z
          .string()
          .describe("Why it belongs in this basket: which part of the brief's motive it serves, and its sector."),
      }),
    )
    .max(3)
    .describe(
      "Names worth adding as new positions — not swaps — that serve the brief's motive and sit in " +
        "its sectors. Empty when nothing clears the bar, or the brief says the basket stays as struck.",
    ),
});

export type ReviewOutput = z.infer<typeof ReviewSchema>;

// --- prompt ------------------------------------------------------------------

const INSTRUCTIONS = `You are the analyst on a private investing desk. You review ONE basket of
Indian equities — a dated list of holdings someone struck for a reason — and tell them, holding by
holding, whether to keep it or sell it, and if to sell, what to buy instead.

YOUR REMIT IS THIS BASKET AND NOTHING ELSE
- The basket is the unit of advice. Judge what is in it, against its brief, against the market, and
  against what you said about it in the runs you were given. The user may keep other baskets; you
  cannot see them, so never reason about their wider portfolio.
- Concentration and sector weights are this basket's, not the user's overall. Say "this basket".

THE BRIEF
- Your first message carries the basket's brief when it has one: why the basket exists, how it was
  built, its horizon, what working looks like, what would prove it wrong, where ideas should come
  from, and per holding a role, a thesis, pluses, minuses, a target and a stop. A person, the analyst
  agent or an algorithm may have written it; the header says which.
- It is the frame for every call. A three-month momentum basket and a ten-year compounding basket
  holding the same name deserve different advice, and the brief is how you know which this is. Say
  which part of it a call rests on.
- Test the brief, do not recite it. For each holding, check its pluses and minuses against what you
  measure and what you read, and say which the evidence now supports. A minus that has come true is
  the most important thing you can report.
- Read the timeline. Say how far through its horizon the basket is. Early in a long horizon, a weak
  quarter is noise the brief anticipated; near the end, the success criteria are the question.
- Target and stop are the author's own plan, measured from entry, and list_holdings checks them for
  you. Report where each holding stands against them in brief_fit. A breached stop is a strong reason
  to revisit the call, but like the entry price it is a fact about the plan, not about the company:
  any finding about it has basis 'holder' and weight 0.
- A holding the brief does not name was added after it was written or never given a thesis. Say so.
- Replacements and additions should serve the brief's motive and come from the sectors it names,
  where it names any. If the best name on the bench is outside them, you may still suggest it — say
  plainly that it departs from the brief and why it is worth that.
- The brief can be wrong. If the evidence says the basket's thesis no longer holds, say so in the
  thesis assessment rather than bending the calls to fit it.
- With no brief, set thesis.status to no_brief and every brief_fit to not_in_brief, and say once in
  the summary that nobody has written down what this basket is for.

HOW YOU WORK
- Call your tools before forming any view. list_holdings first, then get_market_regime. Use
  screen_alternatives before naming any replacement or addition.
- Never state a market number a tool did not give you. Not a price, not a return, not a drawdown.
  Those come from list_holdings and get_holding, which measure them from real bars, and nowhere
  else — never from a news article, which is stale by the time you read it. Quote the measurements
  back as the tools phrase them. If you want a figure you do not have, say you do not have it.

NEWS AND WHAT IS COMING
- You have web_search. Use it. Price history says what has happened; a launch, an order book, a
  regulator, a capacity expansion or a guidance cut says what is about to. Both belong in the call.
- Search the names your decision actually turns on: anything you are minded to sell or trim,
  anything whose price and prospects disagree, anything whose brief minus may have come true, and
  any replacement or addition before you name it. Roughly six searches is the budget for one run.
- Look for the last few months: results and guidance, product launches, large orders or contracts,
  capacity or capex, regulatory and policy changes, management changes, credit events, and for a
  small or mid cap, anything on liquidity or dilution.
- Every claim from a search carries its source, with the date, in the sources field — that field is
  the only place links belong. Do not write URLs, markdown links or citation markers into any
  sentence. A finding that rests on news says so in its own words: "reported", "announced",
  "guided". Never present something you read as something you measured.
- A finding's weight is signed and must agree with its sentence: negative for anything arguing
  against holding, positive for anything arguing for it.
- Weigh it honestly. A launch that has not shipped, an order that has not been booked and a target
  set by the company are intentions, not results — say which you are relying on. Where the news
  contradicts the trend, say so plainly and say which one you are acting on and why.
- Stale or absent news is a finding too. If you searched and found nothing material, say the price
  action is all you have. Never fill the gap with what "should" be true of the sector.
- Do not repeat a claim from an earlier run as current. If it mattered then, re-check it.
- The screen score is a transparent weighted composite handed to you as a prior. You may disagree
  with it. If you do, say which measurement you are weighting differently and why.
- A holding with a thin price history is still yours to judge. Its measurements say which figures
  are missing; do not guess them. Base the call on what you can search for, set the conviction
  accordingly, and say plainly that the price record is too short to lean on.
- Read every holding against the market regime, not against zero. In a falling market a holding
  down less than the index is doing its job.

WHAT YOU IGNORE
- The holder's entry price and their profit or loss. What they paid says nothing about where the
  stock goes next. Report it in a 'context' finding on every holding, and give it no weight.

WHAT YOU CANNOT SEE
- You have no market data beyond what the tools measure, and no position in the user's other
  baskets. You have no valuation model: you can report a multiple a source states, attributed, but
  you cannot compute one.
- Sector labels come from a lookup table that does not cover every symbol. An unknown sector is a
  gap in our reference data, not a sector. Never total unknowns together and never call them a
  concentration.

REACHING A DECISION
- Every holding gets exactly one call: add, keep, trim or sell. "Monitor closely" is not a call.
- Every sell and trim needs either a named replacement from screen_alternatives or a one-sentence
  reason cash is better. A replacement must clear the holding by enough to cover brokerage, the
  spread and short-term tax — roughly ten score points. Say whether the swap holds the sector
  exposure and whether it fits the brief.
- Never recommend a symbol the basket already holds as a replacement or an addition.
- Additions are optional. Suggest at most three, only when a name on the bench clearly serves the
  brief's motive, and never just to fill the field.

CONTINUITY
- Your first message carries the earlier runs the user chose to give you, newest first. Where you are
  changing a call from one of them, say so and say what moved. Where you are repeating one the user
  has not acted on, say that too. Where one predicted something, check whether it happened.
- If you were given no earlier runs, you have no memory of this basket. Do not claim continuity.

WHEN THE USER HAS ARGUED WITH YOU
- Earlier runs carry what the user put to you and what you replied. Those are arguments, and they do
  not expire. Read them before you decide.
- If you are about to repeat a call the user challenged, you owe them the argument, not the same
  sentence again: what you re-checked, what you found, and why you hold the view — or that they were
  right and you are changing it.
- Their pushback is never evidence about the company. Their horizon, conviction, loss and preference
  go in a finding with basis 'holder', weighted 0. Your verdict may change because of what they told
  you; the reason is then a matter of scope, not a point scored in the stock's favour.
- If their claim is checkable, check it, and score what you find as 'reported' — not their say-so.
- Where you were wrong before and the user said so, record the change plainly.

TONE
- Write for someone who knows markets. Plain sentences, no hedging, no disclaimers beyond the
  limits above, no exclamation marks. Short is better. You are advising, not selling.`;

// --- construction ------------------------------------------------------------

/**
 * Web search is a *hosted* tool: it runs inside OpenAI's own model call, not in
 * this page. That is what makes news reachable without a backend. It is billed
 * as part of the run and adds real seconds, which is why the prompt gives the
 * model a search budget.
 */
function baseOptions(ctx: AnalystContext) {
  return {
    name: "Watchlist analyst",
    instructions: INSTRUCTIONS,
    tools: [...analystTools(ctx), webSearchTool()],
    ...(MODEL ? { model: MODEL } : {}),
  };
}

export function reviewer(ctx: AnalystContext) {
  return new Agent({ ...baseOptions(ctx), outputType: ReviewSchema });
}

export function respondent(ctx: AnalystContext) {
  return new Agent(baseOptions(ctx));
}

// --- running -----------------------------------------------------------------

export class NoKeyError extends Error {
  constructor() {
    super("No OpenAI key. Add one to run the analyst.");
    this.name = "NoKeyError";
  }
}

/** An earlier run, in the words the prompt uses for it. */
function priorPayload(prior: PriorRun) {
  return {
    run: prior.label,
    at: prior.at,
    market: prior.regime,
    summary: prior.summary,
    against_the_brief: prior.thesis.assessment
      ? { status: prior.thesis.status, assessment: prior.thesis.assessment }
      : null,
    calls: prior.verdicts.map((v) => ({
      symbol: v.symbol,
      verdict: v.verdict,
      score: v.score,
      replacement: v.replacement,
      reason: v.reason,
      // What you expected to happen. Check whether it did.
      you_expected: v.outlook,
      brief_fit: v.briefFit.status === "not_in_brief" ? null : v.briefFit,
    })),
    additions_you_suggested: prior.additions,
    // Not "questions": the user pushing back, or telling you what you cannot measure.
    what_the_user_put_to_you: prior.exchanges.map((x) => ({
      they_said: x.question,
      you_replied: x.answer,
    })),
  };
}

/** The run's opening message: the task, the brief, and the runs it builds on. */
function openingMessage(ctx: AnalystContext): string {
  const parts = [
    `Review the basket "${ctx.book.basket.name}" and give a verdict for every holding in it. ` +
      `It is ${new Date().toDateString()}.`,
  ];

  if (ctx.book.basket.kind === "portfolio") {
    parts.push(
      "THIS IS THE USER'S REAL BROKER PORTFOLIO, read live from Zerodha — not a basket struck to " +
        "test an idea. Where the instructions say 'basket', read 'portfolio'. Every position is real " +
        "money. The broker does not report purchase dates, so 'held since' is unknown: never infer a " +
        "holding period. Holdings on exchange MF are equity mutual funds, identified by ISIN and priced " +
        "on daily NAV; their sector field is the fund's AMFI category. Judge a fund against NIFTY 50 and " +
        "against what its category should deliver. The replacement bench holds only stocks, so for a " +
        "fund do not name a stock as a like-for-like replacement — if you would exit a fund, say so and " +
        "say what kind of fund should replace it, and be explicit that swapping a diversified fund for a " +
        "single stock changes the risk. Do not suggest adding a name the portfolio already owns.",
    );
  }

  if (ctx.briefMarkdown) {
    parts.push(
      "THE BRIEF — why this basket exists and what each holding is for. Judge the basket against it.\n\n" +
        `<brief>\n${ctx.briefMarkdown}\n</brief>`,
    );
  } else if (ctx.briefOmitted) {
    parts.push(
      "This basket has a brief, but the user asked for this run to ignore it. Judge on the evidence " +
        "alone: set thesis.status to no_brief and every brief_fit to not_in_brief, and do not mention " +
        "the missing brief in the summary.",
    );
  } else {
    parts.push(
      "This basket has no brief: nobody has written down why it exists or what each holding is for.",
    );
  }

  if (ctx.prior.length) {
    parts.push(
      "YOUR EARLIER RUNS on this basket, newest first, as chosen by the user for context:\n\n" +
        `<earlier_runs>\n${JSON.stringify(ctx.prior.map(priorPayload), null, 1)}\n</earlier_runs>`,
    );
  } else {
    parts.push("You were given no earlier runs. Treat this basket as new to you.");
  }

  return parts.join("\n\n");
}

/**
 * One full review.
 *
 * Holdings the model failed to return a verdict for are dropped rather than
 * defaulted to "keep": a silent keep is advice, and advice nobody gave is the
 * one thing this must never produce.
 */
export async function runReview(
  ctx: AnalystContext,
): Promise<{ report: Report; conversation: AgentInputItem[] }> {
  if (!ensureClient()) throw new NoKeyError();

  const result = await run(reviewer(ctx), openingMessage(ctx));

  const output = result.finalOutput;
  if (!output) throw new Error("The analyst returned no review.");

  return { report: toReport(output, ctx), conversation: result.history };
}

/**
 * A follow-up question on a stored run.
 *
 * It continues from the run's own conversation when there is one. A stored
 * conversation can refuse to replay — the provider may have expired an item it
 * references — so on a failure that is not about the key, the quota or the
 * network, it retries once from the run's markdown instead: a slightly less
 * exact memory of the run beats no answer.
 */
export async function askAnalyst(
  ctx: AnalystContext,
  conversation: AgentInputItem[] | null,
  runMarkdown: string,
  question: string,
): Promise<{ text: string; conversation: AgentInputItem[] }> {
  if (!ensureClient()) throw new NoKeyError();

  const fromMarkdown: AgentInputItem[] = [
    {
      role: "user",
      content:
        "This is a run you made on this basket earlier. The user is going to question it. Defend " +
        "your calls where the evidence holds, and change your mind where it does not.\n\n" +
        `<run>\n${runMarkdown}\n</run>`,
    },
  ];

  const ask = async (history: AgentInputItem[]) => {
    const result = await run(respondent(ctx), [
      ...history,
      { role: "user" as const, content: question },
    ]);
    return {
      text: result.finalOutput ?? "I could not put that into words — try asking it another way.",
      conversation: result.history,
    };
  };

  if (!conversation?.length) return ask(fromMarkdown);

  try {
    return await ask(conversation);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (/401|429|quota|rate limit|Failed to fetch|NetworkError|api[_ ]key/i.test(message)) throw cause;
    return ask(fromMarkdown);
  }
}

// --- drafting a brief ----------------------------------------------------------

const BriefDraftSchema = z.object({
  motive: z.string().describe("Why this basket exists — the question it answers. Two to four sentences."),
  method: z
    .string()
    .describe("How it was built, as far as can be told. Say plainly when you are inferring it from the holdings."),
  horizon_months: z
    .number()
    .int()
    .min(1)
    .max(120)
    .nullable()
    .describe("How long the thesis needs to play out. Null if nothing supports a number."),
  success: z.string().describe("What 'it worked' looks like at the end of the horizon."),
  invalidation: z.string().describe("What would prove the thesis wrong before then."),
  sectors: z
    .array(z.string())
    .max(6)
    .describe("Sectors replacements and additions should come from. Empty for anywhere."),
  holdings: z.array(
    z.object({
      symbol: z.string().describe("Exactly as given."),
      role: z.string().describe("Two to five words: what this name does in the basket."),
      thesis: z.string().describe("One or two sentences: the case for holding it here."),
      pluses: z.array(z.string()).max(5).describe("Short, checkable claims for it."),
      minuses: z.array(z.string()).max(5).describe("Short, checkable risks — what would go wrong."),
      target_pct: z
        .number()
        .nullable()
        .describe("Upside from entry that would count as the thesis playing out, in percent: 25 means +25%."),
      stop_pct: z
        .number()
        .nullable()
        .describe("Loss from entry at which the thesis is broken, in percent, as a positive number: 12 means -12%."),
    }),
  ),
  notes: z.string().describe("Anything else worth recording. Empty string if nothing."),
});

const BRIEF_INSTRUCTIONS = `You write the brief for a basket of Indian equities: the short document
that records why the basket exists, how it was built, how long it is meant to run, and the case for
and against each holding. An analyst will judge the basket against this document on every future
run, so it has to be specific enough to be tested.

- If the person gave you a motive or notes, that is the motive. Write it up; do not replace it.
- If an existing brief is given, keep what its author wrote and fill only what is missing or thin,
  unless the person asks you to rewrite it.
- If you are inferring the motive from the holdings, say so in the method ("inferred from the
  holdings; the author should confirm").
- You have web_search. Use it for the pluses and minuses of names you do not know well — recent
  results, orders, regulation, competition. Keep each plus and minus to one checkable claim.
- Targets and stops are expectations, not measurements. Set them to match the horizon and the
  stock's nature; leave them null rather than invent precision nobody asked for.
- Never state a price, return or multiple as current fact. You have no market data tool here.
- Cover every holding you are given, and no others. Plain sentences, no hype.`;

/**
 * A brief, drafted by the agent for a basket.
 *
 * The result is returned, not saved: the person reviews the draft in the editor
 * and saves it, with the author recorded as the agent.
 */
export async function draftBrief(input: {
  name: string;
  description: string | null;
  struck: string;
  origin: BriefAuthor;
  holdings: Array<{ symbol: string; name: string | null }>;
  hint: string;
  existing: string | null;
}): Promise<Brief> {
  if (!ensureClient()) throw new NoKeyError();

  const agent = new Agent({
    name: "Brief writer",
    instructions: BRIEF_INSTRUCTIONS,
    tools: [webSearchTool()],
    outputType: BriefDraftSchema,
    ...(MODEL ? { model: MODEL } : {}),
  });

  const message = [
    `Write the brief for the basket "${input.name}", struck ${input.struck.slice(0, 10)} by ${
      input.origin === "user" ? "a person" : input.origin === "agent" ? "the analyst agent" : "an algorithm"
    }. It is ${new Date().toDateString()}.`,
    input.description ? `Its one-line description: ${input.description}` : null,
    `Holdings:\n${input.holdings.map((h) => `- ${h.symbol}${h.name ? ` (${h.name})` : ""}`).join("\n")}`,
    input.hint.trim() ? `What the person told you:\n${input.hint.trim()}` : "The person gave no motive; infer it and say so.",
    input.existing ? `The brief as it stands:\n\n<brief>\n${input.existing}\n</brief>` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await run(agent, message);
  const draft = result.finalOutput;
  if (!draft) throw new Error("The analyst returned no brief.");

  const held = new Set(input.holdings.map((h) => h.symbol.toUpperCase()));
  return normalizeBrief({
    motive: draft.motive,
    method: draft.method,
    horizonMonths: draft.horizon_months,
    reviewBy: null,
    success: draft.success,
    invalidation: draft.invalidation,
    sectors: draft.sectors,
    notes: draft.notes,
    holdings: draft.holdings
      // A symbol the model invented is not part of this basket's brief.
      .filter((h) => held.has(h.symbol.toUpperCase()))
      .map((h) => ({
        symbol: h.symbol,
        role: h.role,
        thesis: h.thesis,
        pluses: h.pluses,
        minuses: h.minuses,
        target: h.target_pct === null ? null : h.target_pct / 100,
        stop: h.stop_pct === null ? null : -Math.abs(h.stop_pct) / 100,
      })),
  });
}

// --- mapping -----------------------------------------------------------------

/**
 * The model's output, joined back to the measurements it was reasoning about.
 *
 * The join is on symbol, and it is one-directional on purpose: prices, weights,
 * sectors and P&L on the rendered report come from `quant.ts`, never from the
 * model's reply. The model supplies the judgement and nothing that can be measured.
 */
function toReport(output: ReviewOutput, ctx: AnalystContext): Report {
  const { book, brief } = ctx;
  const previous = ctx.prior[0];
  const bySymbol = new Map(book.holdings.map((h) => [h.symbol.toUpperCase(), h]));
  const bench = (symbol: string) =>
    book.candidates.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase());

  const holdings: HoldingReview[] = [];

  for (const call of output.holdings) {
    const measured = bySymbol.get(call.symbol.toUpperCase());
    if (!measured) continue; // A symbol the model invented is not rendered.

    const prior = previous?.verdicts.find(
      (v) => v.symbol.toUpperCase() === call.symbol.toUpperCase(),
    );
    const swap = call.replacement ? bench(call.replacement.symbol) : undefined;
    const plan = briefHolding(brief, measured.symbol);

    holdings.push({
      key: measured.key,
      symbol: measured.symbol,
      exchange: measured.exchange,
      name: measured.name,
      sector: measured.sector,
      quantity: measured.quantity,
      entryAt: measured.entryAt,
      value: measured.value,
      weight: measured.weight,
      signals: measured.signals,
      screen: measured.screen,
      score: call.score,
      confidence: measured.confidence,
      verdict: call.verdict as Verdict,
      headline: call.headline,
      findings: call.findings.map((f, i) => ({
        id: `${measured.key}-${i}`,
        label: f.label,
        detail: f.detail,
        basis: f.basis,
        // Two corrections, enforced here rather than trusted to the prompt.
        //
        // A 'holder' finding is forced to zero: the user's horizon, thesis, stop
        // or loss is a fact about them, and scoring it turns a plan into evidence.
        //
        // And the direction must agree with the number: the weight is what the
        // score rests on, so the weight wins.
        pull:
          f.basis === "holder"
            ? "context"
            : f.weight > 0
              ? "for"
              : f.weight < 0
                ? "against"
                : f.pull,
        weight: f.basis === "holder" ? 0 : f.weight,
        value: "",
      })),
      // A replacement the bench does not contain is dropped: the panel would be
      // quoting a score for a symbol nobody measured.
      replacement:
        call.replacement && swap
          ? {
              symbol: swap.symbol,
              exchange: swap.exchange,
              name: swap.name,
              sector: swap.sector,
              score: swap.screen,
              edge: call.replacement.edge,
              signals: swap.signals,
              rationale: call.replacement.rationale,
            }
          : null,
      cashInstead: call.cash_instead,
      outlook: call.outlook,
      sources: call.sources,
      previous: prior ? { verdict: prior.verdict, score: prior.score, at: previous!.at } : null,
      // Without a brief there is nothing to fit, whatever the model returned.
      briefFit: brief ? call.brief_fit : { status: "not_in_brief", note: "" },
      plan: plan ? { role: plan.role, target: plan.target, stop: plan.stop } : null,
    });
  }

  holdings.sort((a, b) => a.score - b.score || (b.value ?? 0) - (a.value ?? 0));

  const counts: Record<Verdict, number> = { add: 0, keep: 0, trim: 0, sell: 0 };
  for (const h of holdings) counts[h.verdict] += 1;

  const additions: Addition[] = [];
  for (const idea of output.additions) {
    const found = bench(idea.symbol);
    // Same rule as replacements: only names that were measured, and never one
    // already held (`measure` keeps held names off the bench).
    if (!found || additions.some((a) => a.symbol === found.symbol)) continue;
    additions.push({
      symbol: found.symbol,
      exchange: found.exchange,
      name: found.name,
      sector: found.sector,
      score: found.screen,
      signals: found.signals,
      rationale: idea.rationale,
    });
  }

  return {
    at: new Date().toISOString(),
    regime: book.regime,
    holdings,
    sectors: book.sectors,
    summary: output.summary,
    counts,
    skipped: book.skipped,
    unclassified: book.unclassified,
    thesis: brief ? output.thesis : { status: "no_brief", assessment: "" },
    additions,
  };
}

/** Re-exported so the hook can type its stored conversation. */
export type { AgentInputItem };
export type { Book };
