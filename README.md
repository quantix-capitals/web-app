# Stealth Mode

An agent that finds momentum in the market, and helps manage the book you build
from it.

## Layout

```
apps/web        Next.js 15 + Tailwind v4. The UI. Built and running.
apps/agent      The agent, as its own Node service. Structure only — no logic yet.
supabase/       Schema and RLS policies to apply to your project.
```

Three pieces, deliberately: the agent is reached over HTTP, never imported, so it
can be hosted, scaled and redeployed on its own — and it is the only process that
holds the Supabase service-role key.

## Running it

```bash
npm install
npm run dev          # web, on :3000
```

The UI runs with no environment at all. Supabase and the agent are optional until
you wire them; every page renders its pre-data state and the rail shows
"Agent offline".

To connect them: `cp apps/web/.env.example apps/web/.env.local` and fill it in,
then see [supabase/README.md](supabase/README.md).

## Where things are

| You want to change | Look in |
| --- | --- |
| Colours, type scale, spacing | `apps/web/src/app/globals.css` |
| The sidebar and its routes | `apps/web/src/components/shell/nav.ts` |
| Shared UI (badges, stats, empty states, `SymbolLink`) | `apps/web/src/components/ui/primitives.tsx` |
| Where a clicked ticker goes | `googleFinanceUrl` in `apps/web/src/lib/market/symbols.ts` |
| The three.js hero band | `apps/web/src/components/hero/` |
| Supabase wiring | `apps/web/src/lib/supabase/` |
| The agent's HTTP contract | `apps/web/src/lib/agent/client.ts` + `apps/agent/src/routes/` |
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
