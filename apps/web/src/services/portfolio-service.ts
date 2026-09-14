/**
 * The `portfolios` row a broker account is filed under.
 *
 * Holdings are read live from the broker and never stored. The row exists so a
 * portfolio has an id for its brief and its analyst runs to belong to — the
 * same role a `watchlists` row plays for a basket. One row per user per broker
 * account, found or created on first use.
 */

import { supabase } from "./supabase";

export interface BrokerPortfolio {
  id: string;
  createdAt: string;
}

export async function ensureBrokerPortfolio(input: {
  broker: "zerodha";
  account: string;
  name: string;
}): Promise<BrokerPortfolio> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sign in to keep a brief and analyst runs for this portfolio.");

  const { data, error } = await supabase
    .from("portfolios")
    .upsert(
      { user_id: userId, name: input.name, broker: input.broker, broker_account: input.account },
      { onConflict: "user_id,broker,broker_account" },
    )
    .select("id, created_at")
    .single();

  if (error || !data) {
    const message = error?.message ?? "Could not open this portfolio's record.";
    if (/broker|constraint|on conflict/i.test(message)) {
      throw new Error(
        "Portfolio records need a migration. Apply supabase/migrations/0005_portfolio_briefs_and_runs.sql.",
      );
    }
    throw new Error(message);
  }
  return { id: data.id as string, createdAt: data.created_at as string };
}
