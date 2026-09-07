# Supabase

## Applying the schema

Fastest path, for a project you just created in the dashboard:

1. Open the project → **SQL Editor** → New query.
2. Paste `migrations/0001_init.sql` and run it.
3. Project Settings → **API**, copy the URL and the `anon` key into
   `apps/web/.env.local` (see `apps/web/.env.example`).
4. Copy the `service_role` key into `apps/agent/.env`. It never goes anywhere else.

With the CLI instead:

```bash
supabase link --project-ref <ref>
supabase db push
```

## The edge functions

Two, and only two — see the note in the root README about what earns a place
here. `functions/_shared/` holds what both use.

```bash
supabase functions serve                    # local, on :54321
supabase functions deploy market zerodha
```

Both check the caller themselves rather than relying on `verify_jwt`, because the
anon key is a valid project JWT that belongs to nobody. That is why
`config.toml` sets `verify_jwt = false` for each: the check moved inside, where
`zerodha`'s `?op=login` can be exempted (a top-level browser redirect cannot carry
a bearer token).

Their secrets are set on the project, never in a `.env` the browser can reach:

```bash
supabase secrets set KITE_API_KEY=... KITE_API_SECRET=...
supabase secrets set WEB_ORIGIN=https://your-app  ALLOWED_ORIGINS=https://your-app
```

The Kite app's registered redirect URL must be `{WEB_ORIGIN}/zerodha/callback`.

## What the schema assumes

- **RLS is on for every table**, and it is doing real work — the web app talks to
  Supabase with the anon key, so the policies are the only thing scoping rows to
  a user. Do not disable it to debug something; add a policy.
- **`instruments` is shared.** Any signed-in user can read it; only the service
  role writes it. That is why the agent owns symbol upserts.
- **The agent writes with the service role**, which bypasses RLS entirely. Every
  query it runs must filter by `user_id` by hand. See `apps/agent/src/data/supabase.js`.

## Auth

Nothing in the schema assumes a particular provider. Email magic links are the
least work to start with; the `on_auth_user_created` trigger fills in `profiles`
whichever provider you enable.
