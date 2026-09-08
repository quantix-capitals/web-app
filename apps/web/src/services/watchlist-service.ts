/**
 * Baskets: reads and writes, straight from the page.
 *
 * There is no server in front of these. Every statement below runs as the
 * signed-in user against RLS (`supabase/migrations/0002_watchlist_baskets.sql`),
 * so ownership is enforced by Postgres rather than by a check we could forget to
 * write. That is also why `basketDetail` needs no 404 branch of its own: a
 * private basket that isn't yours simply doesn't come back.
 *
 * The one thing that still needs a server is a *price* — Yahoo refuses CORS —
 * so the entry baseline comes from `market-service` and is then written here.
 */

import { fromYahooSymbol, toYahooSymbol } from "@stealth/shared";
import type { ListOrigin, ListVisibility } from "@/lib/types";
import type { WatchlistItemView, WatchlistSummary } from "@/lib/watchlist/types";
import { fetchBaseline, fetchCloseOn } from "./market-service";
import { supabase } from "./supabase";

/**
 * One PostgREST embed per call — lists and their items in a single round trip
 * rather than N+1'ing the items per list.
 */
const EMBED =
  "id, name, description, created_by, visibility, source_run_id, source_scan_id, created_at, updated_at, user_id, " +
  "watchlist_items ( id, quantity, entry_price, entry_at, entry_source, added_at, note, instrument_id, instruments ( symbol, exchange, name ) )";

/* eslint-disable @typescript-eslint/no-explicit-any */
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
/* eslint-enable @typescript-eslint/no-explicit-any */

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// --- Reads -------------------------------------------------------------------

export async function myBaskets(): Promise<WatchlistSummary[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("watchlists")
    .select(EMBED)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => toSummary(row, true));
}

export async function publicBaskets(): Promise<WatchlistSummary[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("watchlists")
    .select(EMBED)
    .eq("visibility", "public")
    .neq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => toSummary(row, false));
}

export async function basketDetail(id: string): Promise<WatchlistSummary | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from("watchlists").select(EMBED).eq("id", id).single();
  if (error || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  return toSummary(row, row.user_id === userId);
}

// --- Writes ------------------------------------------------------------------

/**
 * Thrown by the mutations below. The pages catch it and surface `message` —
 * these are all things a person can act on ("that symbol is already in this
 * basket"), not internal failures.
 */
export class BasketError extends Error {}

function required(value: string | null | undefined, message: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) throw new BasketError(message);
  return trimmed;
}

export async function createBasket(input: {
  name: string;
  description?: string;
  visibility?: ListVisibility;
  origin?: ListOrigin;
}): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new BasketError("Sign in to do that.");

  const name = required(input.name, "Give the basket a name.").slice(0, 80);

  // A basket the agent struck is a published call: it is public so it can be
  // read back and scored by anyone, not just the account it ran under.
  const origin = input.origin ?? "user";
  const visibility = origin === "agent" ? "public" : (input.visibility ?? "private");

  const { data, error } = await supabase
    .from("watchlists")
    .insert({
      user_id: userId,
      name,
      description: input.description?.trim().slice(0, 200) || null,
      created_by: origin,
      visibility,
    })
    .select("id")
    .single();

  if (error || !data) throw new BasketError(error?.message ?? "Could not create the basket.");
  return data.id as string;
}

export async function updateBasket(
  id: string,
  input: { name?: string; description?: string; visibility?: ListVisibility },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    patch.name = required(input.name, "Name can't be empty.").slice(0, 80);
  }
  if (input.description !== undefined) {
    patch.description = input.description.trim().slice(0, 200) || null;
  }
  if (input.visibility !== undefined) patch.visibility = input.visibility;

  const { error } = await supabase.from("watchlists").update(patch).eq("id", id);
  if (error) throw new BasketError(error.message);
}

export async function deleteBasket(id: string): Promise<void> {
  const { error } = await supabase.from("watchlists").delete().eq("id", id);
  if (error) throw new BasketError(error.message);
}

export async function addSymbol(
  basketId: string,
  input: {
    symbol: string;
    exchange?: string;
    name?: string | null;
    quantity?: number;
    entryAt?: string;
  },
): Promise<{ warning?: string }> {
  const symbol = required(input.symbol, "Enter a symbol.").toUpperCase();
  let exchange = (input.exchange ?? "NSE").trim().toUpperCase();
  const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;

  const rpc = await supabase.rpc("upsert_instrument", {
    p_symbol: symbol,
    p_exchange: exchange,
    p_name: input.name ?? null,
  });
  if (rpc.error) throw new BasketError(rpc.error.message);
  let instrumentId = rpc.data as string;

  // Baseline: no entryAt (or today) resolves against a live quote, falling back
  // to today's close; a backdated entryAt resolves against the historical daily
  // close. Failing to resolve is not fatal — the item is inserted with a null
  // baseline — but the reason is carried back to the caller rather than
  // swallowed, because "no price" with no explanation is unfixable from the UI.
  const isBackdated = Boolean(input.entryAt) && !isToday(input.entryAt!);
  let entryPrice: number | null = null;
  let entrySource: "live" | "backfill" | null = null;
  let failure: string | null = null;

  try {
    if (isBackdated) {
      entryPrice = await fetchCloseOn(toYahooSymbol({ symbol, exchange }), input.entryAt!);
      if (entryPrice !== null) entrySource = "backfill";
      else failure = "Yahoo published no close for that date.";
    } else {
      const baseline = await fetchBaseline(toYahooSymbol({ symbol, exchange }));
      if (baseline) {
        entryPrice = baseline.price;
        entrySource = baseline.source;

        // The quote lookup retries a miss on the other Indian exchange, so the
        // symbol that priced may not be the one asked for. Point the item at the
        // instrument that actually has a market.
        const priced = fromYahooSymbol(baseline.yahooSymbol);
        if (priced.exchange !== exchange) {
          const rpcAlt = await supabase.rpc("upsert_instrument", {
            p_symbol: symbol,
            p_exchange: priced.exchange,
            p_name: input.name ?? null,
          });
          if (!rpcAlt.error) {
            instrumentId = rpcAlt.data as string;
            exchange = priced.exchange;
          }
        }
      } else {
        failure = `Yahoo returned no price for ${toYahooSymbol({ symbol, exchange })}.`;
      }
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : "Could not reach Yahoo Finance.";
  }

  const insert = await supabase
    .from("watchlist_items")
    .insert({
      watchlist_id: basketId,
      instrument_id: instrumentId,
      quantity,
      entry_price: entryPrice,
      entry_at: input.entryAt ?? new Date().toISOString(),
      entry_source: entrySource,
    })
    .select("id")
    .single();

  if (insert.error) {
    if (insert.error.code === "23505") {
      throw new BasketError(`${symbol} is already in this basket.`);
    }
    throw new BasketError(insert.error.message);
  }

  if (entryPrice === null) {
    return {
      warning: `Added without a baseline — ${failure ?? "no price was available."} Use "Set entry" on the row to try again.`,
    };
  }
  return {};
}

export async function removeItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("watchlist_items").delete().eq("id", itemId);
  if (error) throw new BasketError(error.message);
}

export async function setQuantity(itemId: string, quantity: number): Promise<void> {
  if (!(quantity > 0)) throw new BasketError("Quantity must be positive.");
  const { error } = await supabase.from("watchlist_items").update({ quantity }).eq("id", itemId);
  if (error) throw new BasketError(error.message);
}

export async function setEntry(
  itemId: string,
  input: { price?: number; at?: string; symbol: string; exchange: string },
): Promise<void> {
  let price = input.price ?? null;
  let source: "manual" | "backfill" | "live" = "manual";

  if (price === null) {
    const yahooSymbol = toYahooSymbol({ symbol: input.symbol, exchange: input.exchange });
    const at = input.at ?? new Date().toISOString();
    try {
      if (isToday(at)) {
        // Today's baseline gets the same live-then-chart treatment as a new
        // item, so retrying a throttled add actually succeeds.
        const baseline = await fetchBaseline(yahooSymbol);
        price = baseline?.price ?? null;
        source = baseline?.source ?? "backfill";
      } else {
        price = await fetchCloseOn(yahooSymbol, at);
        source = "backfill";
      }
    } catch {
      price = null;
    }
  }

  if (price === null) {
    throw new BasketError("Yahoo would not give a price just now — try again shortly.");
  }

  const { error } = await supabase
    .from("watchlist_items")
    .update({
      entry_price: price,
      entry_at: input.at ?? new Date().toISOString(),
      entry_source: source,
    })
    .eq("id", itemId);
  if (error) throw new BasketError(error.message);
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
