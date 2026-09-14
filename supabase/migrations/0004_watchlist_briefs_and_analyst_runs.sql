-- =============================================================================
-- Watchlist briefs and analyst runs
--
-- Two things a basket did not have a home for until now:
--
--   1. **A brief.** One per basket: why it exists, how it was built, how long it
--      is meant to run, and — per holding — the case for, the case against, and
--      the target and stop the thesis implies. Written by whoever struck the
--      basket: a person, the agent, or an algorithm. It is kept twice, as the
--      structured object (`content`, what the editor and the tools read) and as
--      the markdown rendered from it in the same write (`markdown`, what the
--      agent reads and what a download hands over). The two are written together
--      by `services/brief-service.ts`, so they cannot disagree.
--
--   2. **Analyst runs.** Every review the agent produces, kept — never
--      overwritten. A run stores the structured report the page renders its
--      tables and charts from, the same report as markdown, the brief as the
--      agent read it, which earlier runs it was given as context, the questions
--      asked of it afterwards, and the model conversation those questions
--      continue from.
--
-- `list_origin` gains `algorithm`, so a basket struck by a screen or a scheduled
-- job can say so rather than pretending to be a person or the agent.
-- =============================================================================

-- `add value` cannot be used by a statement in the same transaction that added
-- it, so nothing below refers to the new label.
alter type public.list_origin add value if not exists 'algorithm';

-- --- 1. Briefs ----------------------------------------------------------------

create table public.watchlist_briefs (
  -- One brief per basket, so the basket's id is the key. Deleting the basket
  -- deletes its brief.
  watchlist_id uuid primary key references public.watchlists on delete cascade,
  -- Who wrote the brief as it now stands. Separate from the basket's own
  -- `created_by`: an agent can draft the brief for a basket a person struck.
  author       public.list_origin not null default 'user',
  content      jsonb not null,
  markdown     text  not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.watchlist_briefs enable row level security;

create trigger watchlist_briefs_touch_updated_at
  before update on public.watchlist_briefs
  for each row execute function public.touch_updated_at();

-- Readable wherever the basket is: a public basket's thesis is part of the call.
create policy "watchlist_briefs: read via own or public watchlist"
  on public.watchlist_briefs for select to authenticated
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_briefs.watchlist_id
        and (w.user_id = auth.uid() or w.visibility = 'public')
    )
  );

create policy "watchlist_briefs: insert via own watchlist"
  on public.watchlist_briefs for insert to authenticated
  with check (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_briefs.watchlist_id and w.user_id = auth.uid()
    )
  );

create policy "watchlist_briefs: update via own watchlist"
  on public.watchlist_briefs for update to authenticated
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_briefs.watchlist_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_briefs.watchlist_id and w.user_id = auth.uid()
    )
  );

create policy "watchlist_briefs: delete via own watchlist"
  on public.watchlist_briefs for delete to authenticated
  using (
    exists (
      select 1 from public.watchlists w
      where w.id = watchlist_briefs.watchlist_id and w.user_id = auth.uid()
    )
  );

-- --- 2. Analyst runs ----------------------------------------------------------

create table public.watchlist_analyst_runs (
  id              uuid primary key default gen_random_uuid(),
  watchlist_id    uuid not null references public.watchlists on delete cascade,
  -- Runs belong to the person who asked. Anyone may run the analyst over a
  -- public basket, and their runs are theirs — not the basket owner's log.
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  -- `r1`, `r2` … per person per basket: the handle a run is cited by.
  seq             integer not null check (seq > 0),
  model           text,
  summary         text  not null,
  -- `{ add, keep, trim, sell }`, pulled out of `report` so the run list can
  -- render without fetching every report in full.
  counts          jsonb not null,
  -- The structured review the page renders — holdings, findings, signals as
  -- measured at the time, sectors, the brief check. Stored as data rather than
  -- HTML so an old run re-renders with today's components and can be diffed.
  report          jsonb not null,
  markdown        text  not null,
  -- The brief exactly as the agent read it. Null when there was none, or the
  -- run was asked to ignore it.
  brief_markdown  text,
  -- Which earlier runs were handed to this one as context.
  context_run_ids uuid[] not null default '{}',
  -- `[{ at, question, answer }]` — follow-ups asked of this run.
  exchanges       jsonb not null default '[]'::jsonb,
  -- The model's conversation after the run, so a follow-up asked days later
  -- continues from the verdicts actually reached. Large; never selected in lists.
  conversation    jsonb,
  created_at      timestamptz not null default now(),
  unique (watchlist_id, user_id, seq)
);

create index on public.watchlist_analyst_runs (watchlist_id, user_id, created_at desc);
alter table public.watchlist_analyst_runs enable row level security;

create policy "watchlist_analyst_runs: read own"
  on public.watchlist_analyst_runs for select to authenticated
  using (auth.uid() = user_id);

-- Only over a basket you can see: a run over a private basket that is not yours
-- would be a run over holdings you were never shown.
create policy "watchlist_analyst_runs: insert own over a readable watchlist"
  on public.watchlist_analyst_runs for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.watchlists w
      where w.id = watchlist_analyst_runs.watchlist_id
        and (w.user_id = auth.uid() or w.visibility = 'public')
    )
  );

-- Updates exist to append follow-up questions; the verdicts themselves are never
-- rewritten by the app.
create policy "watchlist_analyst_runs: update own"
  on public.watchlist_analyst_runs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "watchlist_analyst_runs: delete own"
  on public.watchlist_analyst_runs for delete to authenticated
  using (auth.uid() = user_id);
