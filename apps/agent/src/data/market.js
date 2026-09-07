/**
 * The market data boundary. Every vendor call in this service goes through here,
 * so switching vendors — which you will, at least once, on price or coverage —
 * is one file and not a search across the codebase.
 *
 * Return vendor-neutral shapes. Nothing downstream should know whose JSON this was.
 *
 * STRUCTURE ONLY.
 */

/** @typedef {{ date: string, open: number, high: number, low: number, close: number, volume: number }} Candle */

/** Latest quote per symbol. Batch — one request per symbol will get you rate limited. */
export async function getQuotes(_symbols) {
  // TODO
}

/** Daily candles, oldest first. Momentum needs ~14 months to compute 12-1. */
export async function getDailyCandles(_symbol, _from, _to) {
  // TODO
}

/** The constituents of an index or a screen. */
export async function getUniverse(_name) {
  // TODO
}
