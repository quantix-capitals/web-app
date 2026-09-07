/**
 * Run lifecycle: queued -> running -> done | failed.
 *
 * Every unit of agent work gets a row before it starts, so a crash mid-scan
 * leaves evidence instead of silence. The UI polls or streams these.
 *
 * STRUCTURE ONLY.
 */

export async function create(_userId, _kind, _input) {
  // TODO -> agent_runs row, status "queued". Returns the run id.
}

export async function markRunning(_runId) {
  // TODO
}

/** A progress event, both persisted and pushed to any open SSE stream. */
export async function emit(_runId, _event) {
  // TODO
}

export async function finish(_runId, _output) {
  // TODO -> status "done", finished_at now
}

export async function fail(_runId, _error) {
  // TODO -> status "failed" with a message safe to show the user
}

export async function get(_runId, _userId) {
  // TODO — filtered by userId; see the note in data/supabase.js
}
