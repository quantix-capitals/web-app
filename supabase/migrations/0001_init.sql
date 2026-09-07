-- =============================================================================
-- Stealth Mode — initial schema
--
-- Run this in the SQL editor of a fresh Supabase project, or with the CLI:
--   supabase db push
--
-- Two rules hold this schema together:
--
--   1. Every user-owned table carries `user_id references auth.users` and has RLS
--      on with a policy keyed to `auth.uid()`. There is no table where "everyone
--      can read" is the right default for someone's positions.
--
--   2. `instruments` is the one shared table — a symbol is not owned by anyone.
--      It is readable by any signed-in user and writable only by the service role
--      (the agent), so a client cannot poison the symbol table.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --- profiles ----------------------------------------------------------------
-- Mirrors auth.users with the app-level fields. Created by the trigger below, so
-- there is never a signed-in user without a profile row.

create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text,
  display_name  text,
  avatar_url    text,
  base_currency text not null default 'INR',
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own"
  on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- instruments -------------------------------------------------------------
-- Shared reference data. Not owned by a user.

create table public.instruments (
  id         uuid primary key default gen_random_uuid(),
  symbol     text not null,
  exchange   text not null default 'NSE',
  name       text,
  sector     text,
  created_at timestamptz not null default now(),
  unique (symbol, exchange)
);

alter table public.instruments enable row level security;

-- Readable by anyone signed in; writes are service-role only (the agent), which
-- bypasses RLS and so needs no policy of its own.
create policy "instruments: read for authenticated"
  on public.instruments for select to authenticated using (true);

-- --- portfolios and holdings -------------------------------------------------

create table public.portfolios (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  name          text not null default 'Main',
  base_currency text not null default 'INR',
  created_at    timestamptz not null default now()
);

create index on public.portfolios (user_id);
alter table public.portfolios enable row level security;

create policy "portfolios: own rows"
  on public.portfolios for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.holdings (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios on delete cascade,
  instrument_id uuid not null references public.instruments on delete restrict,
  -- numeric, not float: a position size that drifts by 1e-9 is a support ticket.
  quantity      numeric(20, 6) not null check (quantity > 0),
  avg_cost      numeric(20, 4) not null check (avg_cost >= 0),
  opened_at     timestamptz,
  updated_at    timestamptz not null default now(),
  unique (portfolio_id, instrument_id)
);

create index on public.holdings (portfolio_id);
alter table public.holdings enable row level security;

-- Ownership is one hop away, so the policy walks the join rather than
-- duplicating user_id onto this table and letting the two disagree.
create policy "holdings: via own portfolio"
  on public.holdings for all
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id and p.user_id = auth.uid()
    )
  );

-- --- trades ------------------------------------------------------------------
-- The ledger. Holdings are a snapshot; this is what actually happened, and it is
-- what realised P&L has to be computed from.

create type public.trade_side as enum ('buy', 'sell');

create table public.trades (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios on delete cascade,
  instrument_id uuid not null references public.instruments on delete restrict,
  side          public.trade_side not null,
  quantity      numeric(20, 6) not null check (quantity > 0),
  price         numeric(20, 4) not null check (price >= 0),
  fees          numeric(20, 4) not null default 0,
  executed_at   timestamptz not null default now(),
  note          text
);

create index on public.trades (portfolio_id, executed_at desc);
alter table public.trades enable row level security;

create policy "trades: via own portfolio"
  on public.trades for all
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id and p.user_id = auth.uid()
    )
  );

-- --- watchlists --------------------------------------------------------------

create table public.watchlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null default 'Watchlist',
  created_at timestamptz not null default now()
);

create index on public.watchlists (user_id);
alter table public.watchlists enable row level security;

create policy "watchlists: own rows"
  on public.watchlists for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.watchlist_items (
  id            uuid primary key default gen_random_uuid(),
  watchlist_id  uuid not null references public.watchlists on delete cascade,
  instrument_id uuid not null references public.instruments on delete cascade,
  note          text,
  added_at      timestamptz not null default now(),
  unique (watchlist_id, instrument_id)
);

create index on public.watchlist_items (watchlist_id);
alter table public.watchlist_items enable row level security;

create policy "watchlist_items: via own watchlist"
  on public.watchlist_items for all
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

-- --- momentum scans ----------------------------------------------------------
-- Every ranking the agent has produced is kept. That history is the only way to
-- ever answer "was it right?", so scans are never overwritten in place.

create type public.scan_status as enum ('queued', 'running', 'done', 'failed');
create type public.signal_direction as enum ('long', 'short');

create table public.momentum_scans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  universe     text not null,
  status       public.scan_status not null default 'queued',
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index on public.momentum_scans (user_id, requested_at desc);
alter table public.momentum_scans enable row level security;

-- The agent writes these with the service role; the user only ever reads them.
create policy "momentum_scans: read own"
  on public.momentum_scans for select using (auth.uid() = user_id);
create policy "momentum_scans: insert own"
  on public.momentum_scans for insert with check (auth.uid() = user_id);

create table public.momentum_signals (
  id            uuid primary key default gen_random_uuid(),
  scan_id       uuid not null references public.momentum_scans on delete cascade,
  instrument_id uuid not null references public.instruments on delete cascade,
  score         numeric(10, 4) not null,
  direction     public.signal_direction not null default 'long',
  rationale     text,
  -- The factor set is the agent's business and will change as it is tuned; a
  -- jsonb column means that is a code change, not a migration.
  factors       jsonb,
  created_at    timestamptz not null default now()
);

create index on public.momentum_signals (scan_id, score desc);
alter table public.momentum_signals enable row level security;

create policy "momentum_signals: via own scan"
  on public.momentum_signals for select
  using (
    exists (
      select 1 from public.momentum_scans s
      where s.id = momentum_signals.scan_id and s.user_id = auth.uid()
    )
  );

-- --- agent runs --------------------------------------------------------------
-- One row per agent invocation, so a run that dies leaves evidence.

create type public.agent_kind as enum ('momentum_scan', 'portfolio_review', 'chat');

create table public.agent_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  kind        public.agent_kind not null,
  status      public.scan_status not null default 'queued',
  input       jsonb,
  output      jsonb,
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index on public.agent_runs (user_id, started_at desc);
alter table public.agent_runs enable row level security;

create policy "agent_runs: read own"
  on public.agent_runs for select using (auth.uid() = user_id);
