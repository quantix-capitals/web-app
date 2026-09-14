/**
 * Basket briefs: one per basket, read and written straight from the page.
 *
 * Same arrangement as `watchlist-service.ts` — every statement runs as the
 * signed-in user against RLS (`supabase/migrations/0004_…`), so a brief is
 * readable wherever its basket is and writable only by the basket's owner.
 *
 * The markdown is rendered here, in the same write as the structured content,
 * so no caller can store one without the other.
 */

import {
  normalizeBrief,
  renderBriefMarkdown,
  type Brief,
  type BriefAuthor,
  type StoredBrief,
} from "@/lib/watchlist/brief";
import { supabase } from "./supabase";

export class BriefError extends Error {}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toStored(row: any): StoredBrief {
  return {
    basketId: row.watchlist_id,
    author: row.author,
    content: normalizeBrief(row.content),
    markdown: row.markdown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The basket's brief, or null when none has been written. */
export async function getBrief(basketId: string): Promise<StoredBrief | null> {
  const { data, error } = await supabase
    .from("watchlist_briefs")
    .select("watchlist_id, author, content, markdown, created_at, updated_at")
    .eq("watchlist_id", basketId)
    .maybeSingle();

  if (error) throw new BriefError(error.message);
  return data ? toStored(data) : null;
}

/**
 * Writes the brief, replacing whatever was there.
 *
 * `basket` carries the two facts the markdown header needs — the name and the
 * struck date — so the document reads correctly when downloaded on its own.
 */
export async function saveBrief(
  basket: { id: string; name: string; createdAt: string },
  brief: Brief,
  author: BriefAuthor,
): Promise<StoredBrief> {
  const content = normalizeBrief(brief);
  const markdown = renderBriefMarkdown(content, {
    name: basket.name,
    struck: basket.createdAt,
    author,
  });

  const { data, error } = await supabase
    .from("watchlist_briefs")
    .upsert(
      { watchlist_id: basket.id, author, content, markdown },
      { onConflict: "watchlist_id" },
    )
    .select("watchlist_id, author, content, markdown, created_at, updated_at")
    .single();

  if (error || !data) throw new BriefError(error?.message ?? "Could not save the brief.");
  return toStored(data);
}
