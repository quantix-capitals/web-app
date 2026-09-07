# Stealth Mode

An agent that finds momentum in the market, and helps manage the book you build
from it.

## Layout

```
apps/web            Vite + React 19 + Tailwind v4. The UI. Built and running.
apps/agent          The agent, as its own Node service. Structure only — no logic yet.
packages/shared     Pure types and symbol plumbing, imported by both sides.
supabase/functions  The two edge functions the browser can't do without.
supabase/migrations Schema and RLS policies to apply to your project.
```

The web app is a single-page app that talks to Postgres directly. That is the
main structural decision here and it is worth being explicit about: **RLS is the
API**. Every read and write goes from the page to Supabase with the anon key, and
`supabase/migrations/` is what decides who may see what. A server that only
re-checked what Postgres already checks would be ceremony.

Exactly two things break that rule, and both are in `supabase/functions/`:

- **`zerodha`** holds `KITE_API_SECRET`, which signs the session checksum. A
  secret in a page is not a secret.
- **`market`** calls Yahoo, which sends no CORS headers and needs an npm client.

If you find yourself adding a third, check it has a reason of the same kind — a
secret to hold, or an upstream that refuses the browser. Otherwise it belongs in
the page.

The agent is a separate matter: it is reached over HTTP, never imported, so it can
be hosted, scaled and redeployed on its own — and it is the only process that
holds the Supabase service-role key.

## Running it

```bash
npm install
npm run dev          # web, on :5173
```

The dev server proxies `/functions/v1` to `http://127.0.0.1:54321`, so
`supabase functions serve` in another terminal gives you quotes and the Zerodha
flow. Without it the app still runs; the pages that need prices say so.

The UI runs with no environment at all. Supabase and the agent are optional until
you wire them; every page renders its pre-data state and the rail shows
"Agent offline".

To connect them: `cp apps/web/.env.example apps/web/.env.local` and fill it in,
then see [supabase/README.md](supabase/README.md).

## Where things are

| You want to change | Look in |
| --- | --- |
| Colours, type scale, spacing | `apps/web/src/globals.css` |
| The sidebar and its routes | `apps/web/src/components/shell/nav.ts` |
| Shared UI (badges, stats, empty states, `SymbolLink`) | `apps/web/src/components/ui/primitives.tsx` |
| Where a clicked ticker goes | `googleFinanceUrl` in `packages/shared/src/symbols.ts` |
| The three.js hero band | `apps/web/src/components/hero/` |
| Routes | `apps/web/src/App.tsx` |
| Supabase wiring, and who is signed in | `apps/web/src/services/supabase.ts`, `src/context/auth-context.tsx` |
| Reads and writes for baskets | `apps/web/src/services/watchlist-service.ts` |
| The two edge functions | `supabase/functions/market/`, `supabase/functions/zerodha/` |
| The agent's HTTP contract | `apps/web/src/services/agent-service.ts` + `apps/agent/src/routes/` |
| Tables and RLS | `supabase/migrations/0001_init.sql` |

## Instruments

There is no in-app instrument page. Every ticker rendered anywhere — watchlist
rows, the basket-contents column, portfolio holdings — is a `SymbolLink`, which
opens the Google Finance quote (`.../quote/SYMBOL:EXCHANGE`) in a new tab so the
view you were reading survives the click. If you render a symbol somewhere new,
render it through `SymbolLink`, not a bare `<span>`.

## Design

The visual system is carried over from the Odyssey app: graphite base, one molten
accent, hairline rules instead of cards. The two rules worth keeping if you edit
it — base-700 and below is structure, base-600 and above is ink, and the type
scale has exactly five sizes. Both are written down in `globals.css`.

On this product `ok` (green) and `danger` (red) mean gain and loss. Don't spend
them on anything decorative.

## Not built yet

- Auth. No sign-in flow; `profile` renders a "Not signed in" state.
- Data fetching. Every page is static; the Supabase clients throw by design.
- The agent. `apps/agent/src` is signatures and comments.
