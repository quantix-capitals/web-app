-- =============================================================================
-- Briefs and analyst runs for broker portfolios, not only baskets
--
-- A Zerodha account is the same thing a basket is — a list of holdings — so it
-- gets the same brief, the same analyst and the same kept runs. Rather than a
-- parallel pair of tables, the two tables from `0004` learn to belong to either
-- a watchlist or a portfolio: exactly one of `watchlist_id` / `portfolio_id` is
-- set on every row, enforced by a check. The table names stay as they are; the
-- `watchlist_` prefix is now historical.
--
-- A broker account maps to one `portfolios` row per user, found by
-- `(user_id, broker, broker_account)`. The holdings themselves are not stored:
-- they are read live from the broker, and the row exists to be the thing a brief
-- and a run hang off.
-- =============================================================================

-- --- portfolios: which broker account a row mirrors ---------------------------

alter table public.portfolios
  add column broker         text,
  add column broker_account text;

alter table public.portfolios
  add constraint portfolios_broker_account_key unique (user_id, broker, broker_account);

-- --- briefs --------------------------------------------------------------------

-- The basket id was the primary key. It cannot stay one once a row may have no
-- basket, so the table gets its own id and keeps one-brief-per-subject through
-- two unique constraints instead.
alter table public.watchlist_briefs drop constraint watchlist_briefs_pkey;

alter table public.watchlist_briefs
  add column id uuid primary key default gen_random_uuid(),
  alter column watchlist_id drop not null,
  add column portfolio_id uuid references public.portfolios on delete cascade,
  add constraint watchlist_briefs_one_subject check (num_nonnulls(watchlist_id, portfolio_id) = 1),
  add constraint watchlist_briefs_watchlist_key unique (watchlist_id),
  add constraint watchlist_briefs_portfolio_key unique (portfolio_id);

-- Additive to the watchlist policies from `0004`: policies are OR-ed, and those
-- all require a matching watchlist, which a portfolio row never has.
create policy "watchlist_briefs: all via own portfolio"
  on public.watchlist_briefs for all to authenticated
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = watchlist_briefs.portfolio_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = watchlist_briefs.portfolio_id and p.user_id = auth.uid()
    )
  );

-- --- analyst runs ----------------------------------------------------------------

alter table public.watchlist_analyst_runs
  alter column watchlist_id drop not null,
  add column portfolio_id uuid references public.portfolios on delete cascade,
  add constraint watchlist_analyst_runs_one_subject check (num_nonnulls(watchlist_id, portfolio_id) = 1),
  add constraint watchlist_analyst_runs_portfolio_seq_key unique (portfolio_id, user_id, seq);

create index on public.watchlist_analyst_runs (portfolio_id, user_id, created_at desc);

-- Select, update and delete are already "own runs" by `user_id`. Insert needed a
-- readable watchlist; a run over your own portfolio is the other way in.
create policy "watchlist_analyst_runs: insert own over own portfolio"
  on public.watchlist_analyst_runs for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.portfolios p
      where p.id = watchlist_analyst_runs.portfolio_id and p.user_id = auth.uid()
    )
  );
