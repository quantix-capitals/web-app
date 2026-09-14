/**
 * Analyst runs: every review the agent produced for a basket, kept.
 *
 * Runs belong to the person who asked for them (RLS in
 * `supabase/migrations/0004_…`), so these queries filter by basket and let
 * Postgres filter by user.
 *
 * Three read shapes, because the columns are very different sizes:
 *
 * - `listRuns` — what the run list draws: no report, no conversation.
 * - `runsForContext` — the reports of the runs a new run builds on, still
 *   without the conversation, which is the one column that can run to hundreds
 *   of kilobytes and is only needed to continue a chat.
 * - `getRun` — one run in full.
 */

import type { AgentInputItem } from "@openai/agents-core";
import { normalizeReport, runLabel } from "@/lib/analyst/report";
import { subjectColumn, type BookRef } from "@/lib/watchlist/book";
import type { Exchange, Report, RunRecord, RunSummary, Verdict } from "@/lib/analyst/types";
import { supabase } from "./supabase";

export class RunError extends Error {}

const SUMMARY = "id, watchlist_id, portfolio_id, seq, model, summary, counts, context_run_ids, created_at";
const CONTEXT = `${SUMMARY}, report, markdown, brief_markdown, exchanges`;
const FULL = `${CONTEXT}, conversation`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toSummary(row: any): RunSummary {
  return {
    id: row.id,
    basketId: row.watchlist_id ?? row.portfolio_id,
    seq: row.seq,
    label: runLabel(row.seq),
    at: row.created_at,
    model: row.model,
    summary: row.summary,
    counts: (row.counts ?? { add: 0, keep: 0, trim: 0, sell: 0 }) as Record<Verdict, number>,
    contextRunIds: row.context_run_ids ?? [],
  };
}

function toRecord(row: any): RunRecord {
  return {
    ...toSummary(row),
    report: normalizeReport(row.report),
    markdown: row.markdown,
    briefMarkdown: row.brief_markdown,
    exchanges: (row.exchanges ?? []) as Exchange[],
    conversation: (row.conversation ?? null) as AgentInputItem[] | null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Newest first. */
export async function listRuns(ref: BookRef): Promise<RunSummary[]> {
  const { data, error } = await supabase
    .from("watchlist_analyst_runs")
    .select(SUMMARY)
    .eq(subjectColumn(ref.kind), ref.id)
    .order("seq", { ascending: false });

  if (error) throw new RunError(error.message);
  return (data ?? []).map(toSummary);
}

export async function getRun(id: string): Promise<RunRecord | null> {
  const { data, error } = await supabase
    .from("watchlist_analyst_runs")
    .select(FULL)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new RunError(error.message);
  return data ? toRecord(data) : null;
}

/** The runs a new run builds on, newest first, without their conversations. */
export async function runsForContext(ids: string[]): Promise<RunRecord[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("watchlist_analyst_runs")
    .select(CONTEXT)
    .in("id", ids)
    .order("seq", { ascending: false });

  if (error) throw new RunError(error.message);
  return (data ?? []).map(toRecord);
}

/**
 * Stores a finished run under the next free number.
 *
 * The number is taken at save time, not when the run started — runs take a
 * minute, and two tabs can both be running one — and the markdown is rendered
 * for the number actually taken, so the document's own heading cannot disagree
 * with the row. If another save claims the number first, the unique constraint
 * refuses this one and it takes the next: the run is the expensive part and has
 * already happened, so it is never thrown away over a label.
 */
export async function saveRun(input: {
  book: BookRef;
  model: string | null;
  report: Report;
  markdownFor: (label: string) => string;
  briefMarkdown: string | null;
  contextRunIds: string[];
  conversation: AgentInputItem[];
}): Promise<RunRecord> {
  let lastError: string | null = null;
  const column = subjectColumn(input.book.kind);

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: top, error: topError } = await supabase
      .from("watchlist_analyst_runs")
      .select("seq")
      .eq(column, input.book.id)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (topError) throw new RunError(topError.message);

    const seq = ((top?.seq as number | undefined) ?? 0) + 1;
    const { data, error } = await supabase
      .from("watchlist_analyst_runs")
      .insert({
        [column]: input.book.id,
        seq,
        model: input.model,
        summary: input.report.summary,
        counts: input.report.counts,
        report: input.report,
        markdown: input.markdownFor(runLabel(seq)),
        brief_markdown: input.briefMarkdown,
        context_run_ids: input.contextRunIds,
        exchanges: [],
        conversation: input.conversation,
      })
      .select(FULL)
      .single();

    if (!error && data) return toRecord(data);
    lastError = error?.message ?? null;
    if (error?.code !== "23505") break;
  }

  throw new RunError(lastError ?? "Could not save the run.");
}

/**
 * Files a follow-up against the run it was asked of.
 *
 * The caller passes the whole exchange list and the re-rendered markdown rather
 * than having this append in SQL: the markdown includes the questions, and it is
 * rendered from the same list in the same pass.
 */
export async function recordExchanges(
  id: string,
  input: { exchanges: Exchange[]; markdown: string; conversation: AgentInputItem[] | null },
): Promise<void> {
  const { error } = await supabase
    .from("watchlist_analyst_runs")
    .update({
      exchanges: input.exchanges,
      markdown: input.markdown,
      ...(input.conversation ? { conversation: input.conversation } : {}),
    })
    .eq("id", id);
  if (error) throw new RunError(error.message);
}

export async function deleteRun(id: string): Promise<void> {
  const { error } = await supabase.from("watchlist_analyst_runs").delete().eq("id", id);
  if (error) throw new RunError(error.message);
}
