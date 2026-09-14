# @stealth/agent

The agent, as its own service. It is not imported by the web app — the boundary
between them is HTTP, so this can be redeployed, scaled, or rewritten without
touching the UI, and a scan that takes two minutes is never holding a Next.js
request open.

Everything in `src/` is **structure only**: signatures, comments, and the wiring
between files. No logic is written yet.

## Layout

```
src/
  server.js              HTTP entry. Routes -> handlers. Nothing else.
  config.js              Env in one place, validated at boot.
  routes/
    scans.js             POST /scans, GET /scans/:id, GET /scans/:id/events
    health.js            GET /health — for whatever hosts this
  agent/
    momentum.js          The scan: universe -> ranked signals
    portfolio.js         Review the book: risk, concentration, exits
    prompts.js           System prompts, kept out of the logic
  data/
    market.js            Price/volume provider. Swap the vendor here, once.
    supabase.js          Service-role client. Reads and writes the same tables the UI reads.
  lib/
    auth.js              Verify the caller's Supabase token -> user id
    runs.js              Run lifecycle: queued -> running -> done/failed
    sse.js               Server-sent events, for streaming a run to the UI
```

## Why the service role lives here and not in the web app

This service holds `SUPABASE_SERVICE_ROLE_KEY`, which bypasses row-level
security. That is the whole reason it is a separate process with its own
secrets: the browser must never see that key. Every request still arrives with
the *user's* token, and `lib/auth.js` turns that into a user id — the agent
writes rows on behalf of a specific user, never anonymously.

## Deploy

Any Node host works (Railway, Fly, Render, a container on Cloud Run). It needs no
filesystem and no sticky sessions; if you use SSE, make sure the host does not
buffer responses.

Set the env from `.env.example`, then point the web app's `NEXT_PUBLIC_AGENT_URL`
at the resulting origin.

## The basket analyst currently runs in the browser

The sidebar on a basket's page (`apps/web/src/lib/analyst/`) is a working agent
built on the **OpenAI Agents SDK**, and for now it runs in the page rather than
here. Its remit is **one basket**: it reviews each holding in it, calls
keep/add/trim/sell, names a replacement or an addition from a bench of liquid NSE
large caps, and judges all of it against the basket's **brief**.

- **Briefs** (`watchlist_briefs`, migration `0004`): one per basket — why it exists,
  how it was built, its horizon, what working and failing look like, and per holding
  a role, a thesis, pluses, minuses, a target and a stop. Stored as structured jsonb
  plus the markdown rendered from it. Written by a person, drafted by the agent, or
  passed by code: `createBasket({ origin: "algorithm", brief })`. Every run is given
  it by default.
- **Runs** (`watchlist_analyst_runs`): every run is kept — the structured report the
  page renders tables and charts from, the same report as markdown, the brief as
  read, which earlier runs it was given as context (chosen per run), the follow-up
  questions, and the model conversation they continue from.

It is laid out so moving it here is a change of transport and nothing else:

| Browser today | Belongs here |
| --- | --- |
| `lib/analyst/quant.ts` — the arithmetic, from bars and live quotes | unchanged, server-side |
| `lib/analyst/tools.ts` — five read-only tools over one measured snapshot | unchanged |
| `lib/analyst/agent.ts` — prompt, zod output schema, two `run()` calls | `agent/watchlist.js` |
| `lib/analyst/client.ts` + `runtime.ts` — the credentials and the OpenAI client | `OPENAI_API_KEY` stops being forwarded into the bundle |
| `lib/analyst/report.ts` + `services/analyst-runs-service.ts` — runs in Supabase | unchanged; the server writes the same row with the service role |

**Why it has to move.** `OPENAI_API_KEY` and `AGENT_MODEL` are read from
`apps/web/.env.local` and forwarded into the browser bundle by a `define` block in
`vite.config.ts`, so the key is in the shipped JavaScript. That is acceptable for
one desk running its own build and unacceptable for a deploy. Nothing above
`runtime.ts` knows where it is running, so the move is: add a route here, delete
that `define` block, and replace the two `run()` calls with a `fetch` carrying the
user's Supabase token.

Runs and briefs already live in Supabase, so the memory follows the user across
devices; only the model call still happens in the browser.
