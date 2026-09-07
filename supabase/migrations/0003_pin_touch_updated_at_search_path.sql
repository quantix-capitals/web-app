-- =============================================================================
-- Pin the search_path on touch_updated_at, and stop trigger functions from
-- being callable as RPCs
--
-- `0002` created this trigger function without a `search_path`, which leaves it
-- resolving names against whatever the caller's path happens to be — the
-- "function_search_path_mutable" advisory.
--
-- It is pinned here rather than elevated: the function only stamps a column on
-- the row already being written, so it needs no privileges beyond the writer's
-- own. That is the difference between it and `touch_parent_watchlist`, which
-- writes the *parent* row and so stays `security definer` on purpose.
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Everything in `public` is exposed by PostgREST, so these trigger functions sit
-- at `/rest/v1/rpc/<name>` for anyone holding the anon key. Postgres refuses to
-- run a trigger function outside a trigger, so this is a hardening measure
-- rather than a live hole — but a `security definer` function should not be
-- reachable from the internet at all, refusal or not.
--
-- `upsert_instrument` is deliberately absent: it is *meant* to be called by a
-- signed-in user, and `0002` already scopes it to `authenticated` only.

revoke all on function public.touch_updated_at()       from public, anon, authenticated;
revoke all on function public.touch_parent_watchlist() from public, anon, authenticated;

-- Same shape, inherited from `0001`: a trigger on `auth.users` and an event
-- trigger, neither of which any client should be able to invoke.
revoke all on function public.handle_new_user()  from public, anon, authenticated;
revoke all on function public.rls_auto_enable()  from public, anon, authenticated;
