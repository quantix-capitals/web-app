/**
 * The OpenAI client the Agents SDK runs against.
 *
 * Split from `client.ts` purely for weight: importing this pulls in the Agents
 * SDK, the OpenAI client and zod — about a megabyte before gzip — so it is loaded
 * dynamically, the first time a review is actually run. `client.ts` holds the key
 * and imports nothing, which is what lets the basket page ask "is a key
 * configured?" for free.
 *
 * The browser-side trade-off this makes is documented at the top of `client.ts`.
 * Read it before shipping this to anyone.
 */

import { OpenAI } from "openai";
import { setDefaultModelProvider, setTracingDisabled } from "@openai/agents-core";
import { OpenAIProvider, setDefaultOpenAIClient } from "@openai/agents-openai";
import { API_KEY } from "./client";

let client: OpenAI | null = null;

/**
 * Installs the client and the model provider the runner will use. False when
 * there is no key to use.
 *
 * **The provider registration is not optional.** Importing the umbrella
 * `@openai/agents` package registers it as a side effect of the import; this code
 * imports `agents-core` and `agents-openai` directly — to keep the realtime
 * package and its WebRTC machinery out of the bundle — so nothing registers it
 * and `run()` fails with "No default model provider set". Doing it here, next to
 * the client, is what keeps that trade sound.
 *
 * `cacheResponsesWebSocketModels: false` mirrors what the umbrella package passes.
 * The websocket transport is for realtime models, which this agent never uses,
 * and a cached socket in a page that may sit open all day is a resource to not
 * hold.
 *
 * Tracing is disabled rather than left on: the SDK's exporter would post every
 * run — prompts, tool arguments, the user's holdings — to OpenAI's trace ingest,
 * and a page that uploads somebody's portfolio as a side effect of rendering a
 * sidebar is not something to opt into quietly.
 */
export function ensureClient(): boolean {
  if (!API_KEY) return false;
  if (client) return true;

  client = new OpenAI({
    apiKey: API_KEY,
    // Required, and exactly as dangerous as it says. See `client.ts`.
    dangerouslyAllowBrowser: true,
  });

  // Order matters: the provider reads the default client when it builds a model,
  // so the client has to be installed first.
  setDefaultOpenAIClient(client);
  setDefaultModelProvider(new OpenAIProvider({ cacheResponsesWebSocketModels: false }));
  setTracingDisabled(true);
  return true;
}
