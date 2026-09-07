-- =============================================================================
-- Watchlist baskets — dated, sized, priced from Yahoo
--
-- Turns `watchlists` from a flat list of symbols into a named, dated basket:
-- who created it (you or the agent), whether it is public, and — via
-- `watchlist_items` — how much of each symbol and at what entry price, so
-- "did this basket make money since it was struck" is a computable question.
--
-- Three things this migration does, in order:
--   1. Widen `watchlists` / `watchlist_items` with provenance, sizing, baseline
--      pricing and visibility.
--   2. Split the single `watchlists`/`watchlist_items` RLS policy so a public
--      list is readable by any *signed-in* user while writes stay owner-only.
--      "Public" never means anonymous — every policy below is `to authenticated`,
--      so the anon key still sees nothing. A public list does expose its
--      `user_id`; `profiles` stays select-own-only, so there is no author name
--      to go with it (v1 shows a "Public" badge, not a name).
--   3. Add `upsert_instrument`, a `security definer` RPC that is the one write
--      path onto the shared `instruments` table for a signed-in user — `0001`
--      grants `authenticated` select-only there, so without this RPC a
--      signed-in user cannot add the *first* occurrence of any symbol.
-- =============================================================================

-- --- 1. Provenance, sizing, baseline, visibility ------------------------------

create type public.list_origin as enum ('user', 'agent');
create type public.entry_source as enum ('live', 'backfill', 'manual');
create type public.list_visibility as enum ('private', 'public');

alter table public.watchlists
  add column description    text,
  add column created_by     public.list_origin     not null default 'user',
  add column visibility     public.list_visibility not null default 'private',
  add column source_run_id  uuid references public.agent_runs     on delete set null,
  add column source_scan_id uuid references public.momentum_scans on delete set null,
  -- `created_at` stays the baseline date and is never touched. `updated_at` is
  -- "last modified" and moves on rename and on membership change (see the
  -- triggers below).
  add column updated_at     timestamptz not null default now();

create index on public.watchlists (user_id, created_at desc);

alter table public.watchlist_items
  add column quantity     numeric(20, 6) not null default 1 check (quantity > 0),
  -- Nullable on purpose: an item can exist before its baseline is known (Yahoo
  -- down, or an agent-inserted backdated pick not yet backfilled). Null means
  -- "no baseline" and the UI renders an em-dash — never a zero.
  add column entry_price  numeric(20, 4) check (entry_price >= 0),
  -- When the baseline was struck — the scan date for a backdated pick. Distinct
  -- from `added_at`, which stays the audit fact of when the row landed.
  add column entry_at     timestamptz,
  -- How the baseline number was obtained: a live quote and a historical close
  -- are not the same figure, and the UI should say which one it is showing.
  add column entry_source public.entry_source;

create index on public.watchlist_items (instrument_id);

-- `updated_at` moves on rename (this table) and on membership change (the
-- child table), via a trigger on each.

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger watchlists_touch_updated_at
  before update on public.watchlists
  for each row execute function public.touch_updated_at();

create or replace function public.touch_parent_watchlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.watchlists
    set updated_at = now()
    where id = coalesce(new.watchlist_id, old.watchlist_id);
  return coalesce(new, old);
end;
$$;

create trigger watchlist_items_touch_parent
  after insert or update or delete on public.watchlist_items
  for each row execute function public.touch_parent_watchlist();

-- --- 2. Split the RLS policies so public read / owner write are independent --

drop policy "watchlists: own rows" on public.watchlists;

create policy "watchlists: read own or public"
  on public.watchlists for select to authenticated
  using (auth.uid() = user_id or visibility = 'public');

create policy "watchlists: insert own"
  on public.watchlists for insert to authenticated
  with check (auth.uid() = user_id);

create policy "watchlists: update own"
  on public.watchlists for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "watchlists: delete own"
  on public.watchlists for delete to authenticated
  using (auth.uid() = user_id);

drop policy "watchlist_items: via own watchlist" on public.watchlist_items;

create policy "watchlist_items: read via own or public watchlist"
  on public.watchlist_items for select to authenticated
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id
        and (w.user_id = auth.uid() or w.visibility = 'public')
    )
  );

create policy "watchlist_items: insert via own watchlist"
  on public.watchlist_items for insert to authenticated
  with check (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
    )
  );

create policy "watchlist_items: update via own watchlist"
  on public.watchlist_items for update to authenticated
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
    )
  );

create policy "watchlist_items: delete via own watchlist"
  on public.watchlist_items for delete to authenticated
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid()
    )
  );

-- --- 3. upsert_instrument — the one write path onto shared `instruments` -----

create or replace function public.upsert_instrument(
  p_symbol text, p_exchange text default 'NSE', p_name text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_symbol   text := upper(btrim(p_symbol));
  v_exchange text := upper(btrim(coalesce(p_exchange, 'NSE')));
  v_id       uuid;
begin
  -- security definer bypasses RLS, so the check RLS would have done is written
  -- by hand, right here.
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if v_symbol !~ '^[A-Z0-9&._-]{1,32}$' then
    raise exception 'Not a valid symbol: %', p_symbol using errcode = '22023';
  end if;
  if v_exchange not in ('NSE', 'BSE') then
    raise exception 'Unsupported exchange: %', p_exchange using errcode = '22023';
  end if;

  insert into public.instruments (symbol, exchange, name)
  values (v_symbol, v_exchange, nullif(left(btrim(p_name), 120), ''))
  on conflict (symbol, exchange) do update
    -- Never blank a curated name with a null one.
    set name = coalesce(public.instruments.name, excluded.name)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_instrument(text, text, text) from public, anon;
grant execute on function public.upsert_instrument(text, text, text) to authenticated;
