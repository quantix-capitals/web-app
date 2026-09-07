import { HoldingsView } from "./holdings-view";

export const metadata = { title: "Portfolio — Stealth Mode" };

/**
 * The book. Reads from Zerodha via `lib/zerodha` and keeps the result in the
 * browser — the `holdings` / `trades` tables in Supabase stay unwired for now, so
 * the whole page is client-rendered off localStorage.
 */
export default function PortfolioPage() {
  return <HoldingsView />;
}
