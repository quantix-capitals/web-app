/**
 * The service-role Supabase client and the queries this service runs.
 *
 * This key bypasses row-level security, which is exactly why it lives in a
 * separate process from the browser bundle. Because RLS is not protecting these
 * calls, **every function here takes a userId and filters on it explicitly.**
 * That discipline is the only thing standing between one user's writes and
 * another user's rows.
 *
 * STRUCTURE ONLY:
 *   npm i @supabase/supabase-js -w @stealth/agent
 */

/** The shared client. Created once; the SDK pools its own connections. */
export function db() {
  // TODO: createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  //   auth: { persistSession: false },
  // })
}

export async function insertScan(_userId, _universe) {
  // TODO -> momentum_scans row
}

export async function insertSignals(_scanId, _signals) {
  // TODO -> momentum_signals, in one batch insert
}

export async function getHoldings(_userId, _portfolioId) {
  // TODO -> holdings joined to instruments
}

/** Upsert by (symbol, exchange) so a scan can reference names not yet in the table. */
export async function upsertInstruments(_instruments) {
  // TODO
}
