/**
 * Shapes the UI renders. These mirror `supabase/migrations/0001_init.sql` — when a
 * column changes there, change it here too. Nothing fetches yet; the pages render
 * their empty state until the Supabase client in `lib/supabase` is wired.
 */

/**
 * Named for meaning, not for colour. `gain` and `loss` are the two that carry
 * real information on this product — everything else is chrome.
 */
export type Tone = "neutral" | "accent" | "gain" | "loss" | "warn" | "info";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  base_currency: string;
  created_at: string;
}

export interface Instrument {
  id: string;
  symbol: string;
  exchange: string;
  name: string | null;
  sector: string | null;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
  created_at: string;
}

export interface Holding {
  id: string;
  portfolio_id: string;
  instrument_id: string;
  quantity: number;
  avg_cost: number;
  opened_at: string | null;
}

export type TradeSide = "buy" | "sell";

export interface Trade {
  id: string;
  portfolio_id: string;
  instrument_id: string;
  side: TradeSide;
  quantity: number;
  price: number;
  fees: number;
  executed_at: string;
  note: string | null;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  instrument_id: string;
  note: string | null;
  added_at: string;
}

export type SignalDirection = "long" | "short";

export interface MomentumScan {
  id: string;
  user_id: string;
  universe: string;
  status: "queued" | "running" | "done" | "failed";
  requested_at: string;
  completed_at: string | null;
}

export interface MomentumSignal {
  id: string;
  scan_id: string;
  instrument_id: string;
  score: number;
  direction: SignalDirection;
  rationale: string | null;
  /** Whatever factors the agent scored on — kept open so the agent owns the schema. */
  factors: Record<string, number> | null;
}

/** One agent invocation, so a run is auditable after the fact. */
export interface AgentRun {
  id: string;
  user_id: string;
  kind: "momentum_scan" | "portfolio_review" | "chat";
  status: "queued" | "running" | "done" | "failed";
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}
