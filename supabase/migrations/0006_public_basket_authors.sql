-- =============================================================================
-- Who struck a public basket, by name
--
-- `profiles` is select-own-only (`0001`), which is right: a profile carries an
-- email address. But a public basket listed as "by Member" hides the one thing a
-- reader wants to know about a published call — whose call it is.
--
-- So this exposes exactly one field, `display_name`, and only for people who
-- have chosen to publish at least one basket. It is a `security definer`
-- function rather than a wider policy on `profiles`, because a policy grants
-- whole rows and every column in them; a function can return the name and
-- nothing else.
-- =============================================================================

create or replace function public.public_basket_authors(p_user_ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name
  from public.profiles p
  where p.id = any (p_user_ids)
    and exists (
      select 1 from public.watchlists w
      where w.user_id = p.id and w.visibility = 'public'
    );
$$;

revoke all on function public.public_basket_authors(uuid[]) from public, anon;
grant execute on function public.public_basket_authors(uuid[]) to authenticated;
