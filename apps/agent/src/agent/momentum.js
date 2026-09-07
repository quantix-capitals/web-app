/**
 * The momentum scan.
 *
 * Shape of the run, so the pieces below have somewhere to sit:
 *
 *   universe  ->  candidates      resolve "nifty500" into a list of instruments
 *             ->  factors         price/volume history -> raw momentum factors
 *             ->  score           factors -> one number per name, ranked
 *             ->  narrate         the model writes the case for the top N only
 *             ->  persist         momentum_scans + momentum_signals rows
 *
 * The split matters: scoring is arithmetic and must be reproducible, so it stays
 * out of the model entirely. The model is asked only to explain a ranking it did
 * not produce — which is a question it can be wrong about without corrupting the
 * numbers.
 *
 * STRUCTURE ONLY.
 */

/** Resolve a universe name into the instruments to score. */
export async function resolveUniverse(_universe) {
  // TODO: return instrument rows. Cache — the constituent list changes rarely.
}

/**
 * Raw factors per instrument, from price and volume history.
 * Candidates worth computing: 12-1 month return (skipping the most recent month,
 * which mean-reverts), 3-month return, distance from 52-week high, volume
 * expansion vs its own average, and realised volatility to divide by.
 */
export async function computeFactors(_instruments) {
  // TODO
}

/** Factors -> a single comparable score. Pure function: same input, same output. */
export function scoreCandidates(_factors) {
  // TODO: normalise each factor cross-sectionally (z-score or rank) before
  // combining, or whichever factor has the widest raw spread silently decides
  // the whole ranking.
}

/** The model's case for each of the top names — prose, not numbers. */
export async function narrateTop(_ranked, _limit = 20) {
  // TODO: one call with the top slice, not one call per name.
}

/** The whole scan, start to finish. Reports progress through lib/runs.js. */
export async function runMomentumScan(_runId, _input) {
  // TODO: the pipeline above, wrapped so any throw marks the run failed with a
  // message the UI can show.
}
