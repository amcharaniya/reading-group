-- Switch to one shared site password. Run once in the Supabase SQL Editor (safe to re-run).
--
-- How it works: the site signs in to a single shared Supabase account (the email in js/config.js,
-- `sharedLoginEmail`) with the password you choose. That account is allowed in by `site_accounts`.
-- After signing in, each device picks "who's reading" (Amaan or Mae), and the site stamps that name on
-- articles it adds or edits. Personal email sign-ins keep working too.

-- 1. Accounts that may use the site without being a named member (just the shared one).
create table if not exists public.site_accounts (email text primary key);
alter table public.site_accounts enable row level security;   -- no policies: not readable from the site

insert into public.site_accounts (email) values ('reading-group@pursuit-of-ilm.com')
on conflict (email) do nothing;

-- 2. Whether whoever is signed in may use the site.
create or replace function public.is_reader() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_name() is not null
      or exists (select 1 from public.site_accounts where lower(email) = lower(auth.jwt() ->> 'email'))
$$;
grant execute on function public.is_reader() to authenticated;

-- 3. The shared account has no name of its own, so the site says who entered / edited each article.
--    A personal sign-in still stamps its own name.
create or replace function public.readings_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(public.my_name(), new.updated_by);
  new.entered_by := old.entered_by;
  return new;
end $$;

-- 4. Policies: anyone allowed in can read and change articles and see member names.
drop policy if exists "members see members" on public.members;
create policy "members see members" on public.members
  for select to authenticated using (public.is_reader());

drop policy if exists "members read articles" on public.readings;
create policy "members read articles" on public.readings
  for select to authenticated using (public.is_reader());

drop policy if exists "members add articles" on public.readings;
create policy "members add articles" on public.readings
  for insert to authenticated
  with check (public.is_reader() and entered_by = coalesce(public.my_name(), entered_by));

drop policy if exists "members edit articles" on public.readings;
create policy "members edit articles" on public.readings
  for update to authenticated using (public.is_reader()) with check (public.is_reader());

drop policy if exists "members delete articles" on public.readings;
create policy "members delete articles" on public.readings
  for delete to authenticated using (public.is_reader());
