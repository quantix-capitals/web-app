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
