/**
 * The agent module, loaded on first use.
 *
 * `import("./agent")` pulls in the Agents SDK, the OpenAI client and zod — about
 * a megabyte. Loading that when a basket page renders would put it in front of
 * every reader for a feature most of them will not use on any given visit. The
 * click that spends tokens is also the click that pays for the download.
 *
 * A failed load is forgotten rather than cached, so a flaky connection costs one
 * click, not the rest of the session.
 */

let agentModule: Promise<typeof import("./agent")> | null = null;

export function loadAgent() {
  agentModule ??= import("./agent").catch((cause: unknown) => {
    agentModule = null;
    throw cause;
  });
  return agentModule;
}
