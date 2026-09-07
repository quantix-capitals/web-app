/**
 * The web app's side of the agent service. STRUCTURE ONLY — no calls are made yet.
 *
 * The agent is hosted separately (see `apps/agent`), so this is an HTTP boundary,
 * not an import. Keeping it that way is the point: the agent can be redeployed,
 * scaled, or rewritten without touching the UI, and a long-running scan is never
 * holding a Next.js request open.
 *
 * The shape to implement:
 *   POST {AGENT_URL}/scans          -> { runId }        start a momentum scan
 *   GET  {AGENT_URL}/scans/:id      -> AgentRun         poll one run
 *   GET  {AGENT_URL}/scans/:id/events -> SSE            stream a run as it works
 *
 * Auth: forward the user's Supabase access token as a bearer token and let the
 * agent verify it against the same project. Never send the service-role key from
 * the browser.
 */

import type { AgentRun } from "@/lib/types";

export const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "";

export function isAgentConfigured(): boolean {
  return Boolean(AGENT_URL);
}

export interface StartScanInput {
  /** Which universe to rank — e.g. "nifty500". The agent owns the list. */
  universe: string;
  /** Optional free-text steer: "avoid banks", "only large caps". */
  intent?: string;
}

export async function startScan(_input: StartScanInput): Promise<{ runId: string }> {
  throw new Error("Agent service is not wired yet. Set NEXT_PUBLIC_AGENT_URL.");
}

export async function getRun(_runId: string): Promise<AgentRun> {
  throw new Error("Agent service is not wired yet. Set NEXT_PUBLIC_AGENT_URL.");
}

/** Subscribe to a run's events. Returns an unsubscribe function. */
export function subscribeToRun(
  _runId: string,
  _onEvent: (event: unknown) => void,
): () => void {
  throw new Error("Agent service is not wired yet. Set NEXT_PUBLIC_AGENT_URL.");
}
