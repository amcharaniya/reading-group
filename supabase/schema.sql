-- Reading Group: article storage.
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- It is safe to re-run.
--
-- Who can do what (enforced by the database, not the website):
--   * Only emails listed in `members` can see or change anything.
--   * Anyone else who signs in sees an empty site.
--   * Every article records which member entered it (`entered_by`) and who last edited it (`updated_by`).

-- 1. Members: the email each person signs in with, and their name on the site.
create table if not exists public.members (
  email text primary key,
  name  text not null unique
);

-- The site name for whoever is signed in (null if their email isn't a member).
create or replace function public.my_name() returns text
language sql stable security definer set search_path = public as $$
  select name from public.members where lower(email) = lower(auth.jwt() ->> 'email')
$$;

-- 2. Articles. Each row is one article read at one meeting.
create table if not exists public.readings (
  id           bigint generated always as identity primary key,
  url          text not null,
  title        text not null,
  authors      text,
  publisher    text,
  published_on date,
  image_url    text,
  description  text,
  meeting_date date not null,                                        -- the date we read / discuss it
  selected_by  text not null references public.members (name) on update cascade,
  entered_by   text not null default public.my_name() references public.members (name) on update cascade,
  updated_by   text references public.members (name) on update cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists readings_meeting_date_idx on public.readings (meeting_date desc);

-- Stamp who edited a row and when; entered_by can't be changed after the fact.
create or replace function public.readings_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := public.my_name();
  new.entered_by := old.entered_by;
  return new;
end $$;

drop trigger if exists readings_touch on public.readings;
create trigger readings_touch before update on public.readings
  for each row execute function public.readings_touch();

-- 3. Row-level security.
alter table public.members  enable row level security;
alter table public.readings enable row level security;

drop policy if exists "members see members" on public.members;
create policy "members see members" on public.members
  for select to authenticated
  using (public.my_name() is not null);

drop policy if exists "members read articles" on public.readings;
create policy "members read articles" on public.readings
  for select to authenticated
  using (public.my_name() is not null);

drop policy if exists "members add articles" on public.readings;
create policy "members add articles" on public.readings
  for insert to authenticated
  with check (public.my_name() is not null and entered_by = public.my_name());

drop policy if exists "members edit articles" on public.readings;
create policy "members edit articles" on public.readings
  for update to authenticated
  using (public.my_name() is not null)
  with check (public.my_name() is not null);

drop policy if exists "members delete articles" on public.readings;
create policy "members delete articles" on public.readings
  for delete to authenticated
  using (public.my_name() is not null);

grant select on public.members to authenticated;
grant select, insert, update, delete on public.readings to authenticated;
grant execute on function public.my_name() to authenticated;

-- 4. Add the two of you in a separate query (kept out of this public repo) — see supabase/setup.local.sql.
