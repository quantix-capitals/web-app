/**
 * The portfolio side: what the agent says about the book you already hold.
 *
 * Deliberately separate from momentum.js. Finding a name and deciding what to do
 * about a position you are already in are different questions — the second one
 * has to care about cost basis, concentration, and what you would be selling.
 *
 * STRUCTURE ONLY.
 */

/** Current value, cost basis, and per-position P&L. Arithmetic, not model work. */
export async function valueBook(_portfolioId) {
  // TODO
}

/** Concentration, sector skew, and correlation between the largest positions. */
export async function assessRisk(_positions) {
  // TODO
}

/**
 * The review the user actually reads: what changed, what is working, what has
 * stopped working. Never phrased as an instruction to trade — the agent's job is
 * to make the case, not to place the order.
 */
export async function reviewPortfolio(_runId, _portfolioId) {
  // TODO
}
