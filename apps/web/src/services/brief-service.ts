/**
 * Briefs: one per book — a basket or a broker portfolio — read and written
 * straight from the page.
 *
 * Same arrangement as `watchlist-service.ts` — every statement runs as the
 * signed-in user against RLS (`supabase/migrations/0004_…` and `0005_…`), so a
 * basket's brief is readable wherever its basket is and writable by its owner,
 * and a portfolio's brief is its owner's alone.
 *
 * The markdown is rendered here, in the same write as the structured content,
 * so no caller can store one without the other.
 */

import { subjectColumn, type BookRef } from "@/lib/watchlist/book";
import {
  normalizeBrief,
  renderBriefMarkdown,
  type Brief,
  type BriefAuthor,
  type StoredBrief,
} from "@/lib/watchlist/brief";
import { supabase } from "./supabase";

export class BriefError extends Error {}

const COLUMNS = "watchlist_id, portfolio_id, author, content, markdown, created_at, updated_at";

/* eslint-disable @typescript-eslint/no-explicit-any */
function toStored(row: any): StoredBrief {
  return {
    basketId: row.watchlist_id ?? row.portfolio_id,
    author: row.author,
    content: normalizeBrief(row.content),
    markdown: row.markdown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The book's brief, or null when none has been written. */
export async function getBrief(ref: BookRef): Promise<StoredBrief | null> {
  const { data, error } = await supabase
    .from("watchlist_briefs")
    .select(COLUMNS)
    .eq(subjectColumn(ref.kind), ref.id)
    .maybeSingle();

  if (error) throw new BriefError(error.message);
  return data ? toStored(data) : null;
}

/**
 * Writes the brief, replacing whatever was there.
 *
 * `book` carries the facts the markdown header needs — the name and the date the
 * book was struck or first connected — so the document reads correctly when
 * downloaded on its own.
 */
export async function saveBrief(
  book: BookRef & { name: string; createdAt: string },
  brief: Brief,
  author: BriefAuthor,
): Promise<StoredBrief> {
  const content = normalizeBrief(brief);
  const markdown = renderBriefMarkdown(content, {
    name: book.name,
    struck: book.createdAt,
    author,
  });
  const column = subjectColumn(book.kind);

  const { data, error } = await supabase
    .from("watchlist_briefs")
    .upsert({ [column]: book.id, author, content, markdown }, { onConflict: column })
    .select(COLUMNS)
    .single();

  if (error || !data) throw new BriefError(error?.message ?? "Could not save the brief.");
  return toStored(data);
}
