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
