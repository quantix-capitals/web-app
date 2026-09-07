import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import type { WatchlistItemView, WatchlistSummary } from "./types";

/**
 * One PostgREST embed per call — lists and their items in a single round
 * trip rather than N+1'ing the items per list.
 */
const EMBED =
  "id, name, description, created_by, visibility, source_run_id, source_scan_id, created_at, updated_at, user_id, " +
  "watchlist_items ( id, quantity, entry_price, entry_at, entry_source, added_at, note, instrument_id, instruments ( symbol, exchange, name ) )";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSummary(row: any, isOwner: boolean): WatchlistSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    visibility: row.visibility,
    sourceScanId: row.source_scan_id,
    sourceRunId: row.source_run_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwner,
    items: (row.watchlist_items ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any): WatchlistItemView => ({
        id: item.id,
        quantity: Number(item.quantity),
        entryPrice: item.entry_price === null ? null : Number(item.entry_price),
        entryAt: item.entry_at,
        entrySource: item.entry_source,
        addedAt: item.added_at,
        note: item.note,
        symbol: item.instruments?.symbol ?? "",
        exchange: item.instruments?.exchange ?? "NSE",
        name: item.instruments?.name ?? null,
        instrumentId: item.instrument_id,
      }),
    ),
  };
}

export async function listSummaries(): Promise<WatchlistSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("watchlists")
    .select(EMBED)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => toSummary(row, true));
}

export async function publicSummaries(): Promise<WatchlistSummary[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("watchlists")
    .select(EMBED)
    .eq("visibility", "public")
    .neq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => toSummary(row, false));
}

/**
 * RLS is the 404 here — a private basket that isn't yours simply doesn't come
 * back, so there is no hand-written ownership check to get wrong.
 */
export async function listDetail(id: string): Promise<WatchlistSummary | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("watchlists").select(EMBED).eq("id", id).single();

  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  return toSummary(row, row.user_id === user.id);
}
