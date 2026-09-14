/**
 * Query keys for a basket's brief and its analyst runs, in one place so a
 * mutation and the query it updates can never drift apart.
 *
 * Nested under `["baskets", id]` so invalidating a basket refreshes what hangs
 * off it too.
 */

export const briefKey = (basketId: string) => ["baskets", basketId, "brief"] as const;
export const runsKey = (basketId: string) => ["baskets", basketId, "analyst-runs"] as const;
export const runKey = (runId: string) => ["analyst-run", runId] as const;
