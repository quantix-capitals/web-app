/**
 * Liveness for whatever hosts this. Deliberately does not touch Supabase or the
 * market data vendor: a health check that fails when a dependency blips will get
 * the service restarted for no reason.
 */

export function health(_req, _res) {
  // TODO: respond 200 { ok: true, version }.
}
