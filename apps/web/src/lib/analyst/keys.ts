/**
 * Query keys for a book's brief and its analyst runs, in one place so a
 * mutation and the query it updates can never drift apart.
 *
 * Nested under the book's own key — `["baskets", id]` or `["portfolios", id]` —
 * so invalidating a basket refreshes what hangs off it too.
 */

import type { BookRef } from "@/lib/watchlist/book";

const root = (ref: BookRef) => [ref.kind === "portfolio" ? "portfolios" : "baskets", ref.id] as const;

export const briefKey = (ref: BookRef) => [...root(ref), "brief"] as const;
export const runsKey = (ref: BookRef) => [...root(ref), "analyst-runs"] as const;
export const runKey = (runId: string) => ["analyst-run", runId] as const;
