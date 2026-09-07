"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getBaselinePrice, getCloseOn } from "@/lib/market/yahoo";
import { fromYahooSymbol, toYahooSymbol } from "@/lib/market/symbols";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import type { ListOrigin, ListVisibility } from "@/lib/types";

export type ActionResult<T = unknown> =
  | ({ status: "ok" } & T)
  | { status: "error"; error: string };

const NOT_SIGNED_IN: ActionResult<never> = {
  status: "error",
  error: "Sign in to do that.",
};

export async function createList(input: {
  name: string;
  description?: string;
  visibility?: ListVisibility;
  origin?: ListOrigin;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/profile");

  const name = input.name.trim().slice(0, 80);
  if (!name) return;

  // A basket the agent struck is a published call: it is public so it can be
  // read back and scored by anyone, not just the account it ran under.
  const origin = input.origin ?? "user";
  const visibility = origin === "agent" ? "public" : (input.visibility ?? "private");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("watchlists")
    .insert({
      user_id: user.id,
      name,
      description: input.description?.trim().slice(0, 200) || null,
      created_by: origin,
      visibility,
    })
    .select("id")
    .single();

  if (error || !data) return;
  revalidatePath("/watchlist");
  redirect(`/watchlist/${data.id}`);
}

export async function updateList(
  id: string,
  input: { name?: string; description?: string; visibility?: ListVisibility },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim().slice(0, 80);
    if (!name) return { status: "error", error: "Name can't be empty." };
    patch.name = name;
  }
  if (input.description !== undefined) {
    patch.description = input.description.trim().slice(0, 200) || null;
  }
  if (input.visibility !== undefined) patch.visibility = input.visibility;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("watchlists").update(patch).eq("id", id);
  if (error) return { status: "error", error: error.message };

  revalidatePath("/watchlist");
  revalidatePath(`/watchlist/${id}`);
  return { status: "ok" };
}

export async function deleteList(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/profile");

  const supabase = await createServerSupabase();
  await supabase.from("watchlists").delete().eq("id", id);
  revalidatePath("/watchlist");
  redirect("/watchlist");
}

export async function addSymbol(
  listId: string,
  input: {
    symbol: string;
    exchange?: string;
    name?: string | null;
    quantity?: number;
    entryAt?: string;
  },
): Promise<ActionResult<{ warning?: string }>> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) return { status: "error", error: "Enter a symbol." };
  let exchange = (input.exchange ?? "NSE").trim().toUpperCase();
  const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;

  const supabase = await createServerSupabase();

  let instrumentId: string | null = null;
  const rpc = await supabase.rpc("upsert_instrument", {
    p_symbol: symbol,
    p_exchange: exchange,
    p_name: input.name ?? null,
  });
  if (rpc.error) return { status: "error", error: rpc.error.message };
  instrumentId = rpc.data as string;

  // Baseline: no entryAt (or today) resolves against a live quote, falling
  // back to today's close; a backdated entryAt resolves against the historical
  // daily close. Failing to resolve is not fatal — the item is inserted with a
  // null baseline — but the reason is carried back to the caller rather than
  // swallowed, because "no price" with no explanation is unfixable from the UI.
  const isBackdated = Boolean(input.entryAt) && !isToday(input.entryAt!);
  let entryPrice: number | null = null;
  let entrySource: "live" | "backfill" | null = null;
  let failure: string | null = null;

  try {
    if (isBackdated) {
      entryPrice = await getCloseOn(toYahooSymbol({ symbol, exchange }), input.entryAt!);
      if (entryPrice !== null) entrySource = "backfill";
      else failure = "Yahoo published no close for that date.";
    } else {
      const baseline = await getBaselinePrice(toYahooSymbol({ symbol, exchange }));
      if (baseline) {
        entryPrice = baseline.price;
        entrySource = baseline.source;

        // `getQuotes` retries a miss on the other Indian exchange, so the
        // symbol that priced may not be the one asked for. Point the item at
        // the instrument that actually has a market.
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
      watchlist_id: listId,
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
      return { status: "error", error: `${symbol} is already in this basket.` };
    }
    return { status: "error", error: insert.error.message };
  }

  revalidatePath(`/watchlist/${listId}`);
  revalidatePath("/watchlist");

  if (entryPrice === null) {
    return {
      status: "ok",
      warning: `Added without a baseline — ${failure ?? "no price was available."} Use “Set entry” on the row to try again.`,
    };
  }
  return { status: "ok" };
}

export async function removeItem(itemId: string, listId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("watchlist_items").delete().eq("id", itemId);
  if (error) return { status: "error", error: error.message };

  revalidatePath(`/watchlist/${listId}`);
  revalidatePath("/watchlist");
  return { status: "ok" };
}

export async function setQuantity(
  itemId: string,
  listId: string,
  quantity: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  if (!(quantity > 0)) return { status: "error", error: "Quantity must be positive." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("watchlist_items").update({ quantity }).eq("id", itemId);
  if (error) return { status: "error", error: error.message };

  revalidatePath(`/watchlist/${listId}`);
  return { status: "ok" };
}

export async function setEntry(
  itemId: string,
  listId: string,
  input: { price?: number; at?: string; symbol: string; exchange: string },
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const supabase = await createServerSupabase();
  let price = input.price ?? null;
  let source: "manual" | "backfill" | "live" = "manual";

  if (price === null) {
    const yahooSymbol = toYahooSymbol({ symbol: input.symbol, exchange: input.exchange });
    const at = input.at ?? new Date().toISOString();
    try {
      if (isToday(at)) {
        // Today's baseline gets the same live-then-chart treatment as a new
        // item, so retrying a throttled add actually succeeds.
        const baseline = await getBaselinePrice(yahooSymbol);
        price = baseline?.price ?? null;
        source = baseline?.source ?? "backfill";
      } else {
        price = await getCloseOn(yahooSymbol, at);
        source = "backfill";
      }
    } catch {
      price = null;
    }
  }

  if (price === null) {
    return { status: "error", error: "Yahoo would not give a price just now — try again shortly." };
  }

  const { error } = await supabase
    .from("watchlist_items")
    .update({ entry_price: price, entry_at: input.at ?? new Date().toISOString(), entry_source: source })
    .eq("id", itemId);
  if (error) return { status: "error", error: error.message };

  revalidatePath(`/watchlist/${listId}`);
  return { status: "ok" };
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
