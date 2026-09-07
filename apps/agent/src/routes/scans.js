/**
 * The scan endpoints — the agent's whole public surface for now.
 *
 * The contract these implement is written down on the web side too, in
 * `apps/web/src/lib/agent/client.ts`. Change one, change the other.
 *
 * STRUCTURE ONLY.
 */

/**
 * POST /scans  { universe, intent? } -> 202 { runId }
 *
 * Answers as soon as the run row exists, and does the work after — a momentum
 * scan takes far longer than any sensible request timeout, and the UI wants an id
 * to start streaming from immediately.
 */
export function createScan(_req, _res) {
  // TODO:
  //   1. requireUser(req) -> userId  (lib/auth.js)
  //   2. parse + validate the body
  //   3. runs.create(userId, "momentum_scan", input) -> runId
  //   4. respond 202 { runId }
  //   5. runMomentumScan(runId, ...) — not awaited; it reports through runs.js
}

/** GET /scans/:id -> the run row, scoped to the caller. */
export function getScan(_req, _res) {
  // TODO: requireUser, then runs.get(runId) — and 404 rather than 403 if the run
  // belongs to someone else, so this endpoint can't be used to probe for ids.
}

/**
 * GET /scans/:id/events -> text/event-stream
 *
 * The live view of a run. Send a heartbeat comment every ~15s or proxies in front
 * of this service will close an idle stream mid-scan.
 */
export function streamScan(_req, _res) {
  // TODO: requireUser, open an SSE stream (lib/sse.js), subscribe to the run's
  // events, and close it when the run reaches a terminal state.
}
