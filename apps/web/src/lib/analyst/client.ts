/**
 * The OpenAI credentials the analyst runs on, read from the environment.
 *
 * `OPENAI_API_KEY` and `AGENT_MODEL` come from `apps/web/.env.local`, alongside
 * the Supabase values — one place for the desk's keys, and nothing to paste into
 * the UI. Vite hides unprefixed variables from the browser bundle by default, so
 * `vite.config.ts` forwards these two explicitly; the comment there is the one
 * worth reading before this ships.
 *
 * **The trade-off, stated plainly.** The agent runs in the page, so the key is in
 * the bundle: anyone who loads the app can read it out of the JavaScript, and
 * every request is visible in the network tab. That is fine for one desk running
 * its own build, and it is not fine for a deployed product — a key in a bundle is
 * a key on the internet. The fix is the one `apps/agent` already exists for: move
 * `runReview` behind it, keep `OPENAI_API_KEY` as a server secret, and have the
 * browser send the user's Supabase token instead. Everything above this file is
 * written so that move is a change of transport and nothing else — the tools, the
 * prompt and the memo do not know where they are running.
 *
 * **This file imports nothing.** It is loaded on every basket render to answer "is
 * a key configured?", and the SDK plus the OpenAI client are about a megabyte of
 * JavaScript — so they live in `runtime.ts`, imported dynamically the first time
 * the agent actually runs. A reader who never opens the panel never downloads it.
 */

/** The key, or `null` when the build was made without one. */
export const API_KEY: string | null = import.meta.env.VITE_OPENAI_API_KEY || null;

/**
 * The model, or `undefined` to take the SDK's own default.
 *
 * Set as `AGENT_MODEL`, so this app and `apps/agent` name the model in the same
 * place and cannot drift apart.
 */
export const MODEL: string | undefined = import.meta.env.VITE_OPENAI_MODEL || undefined;

/** Whether the analyst can run at all. The panel asks before offering to. */
export function isConfigured(): boolean {
  return API_KEY !== null;
}

/**
 * Where to set the key, for the message the panel shows when it is missing.
 *
 * Named here rather than written into the component, so the file that knows which
 * variables are read is also the file that says what to set.
 */
export const KEY_SETUP = {
  file: "apps/web/.env.local",
  keyVar: "OPENAI_API_KEY",
  modelVar: "AGENT_MODEL",
} as const;
