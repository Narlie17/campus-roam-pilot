-- Campus ROAM: Supabase database schema
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Safe to run again: it only creates things that do not exist yet.
-- Every table has Row Level Security, so each student can only read and change their own rows.
-- The "school" column on each table is the hook for multi-tenancy (one database, many campuses).

create extension if not exists pgcrypto;

-- ---------- profiles (one per sign-up) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  school text not null default 'georgia-southern',
  email text,
  first_name text check (char_length(first_name) <= 80),
  major text,
  year text,
  campus text,
  interests text[] not null default '{}',
  onboarded boolean not null default false,
  consent boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Upgrade older ROAM databases in place (adds anything missing, keeps existing data).
alter table public.profiles
  add column if not exists school text not null default 'georgia-southern',
  add column if not exists email text,
  add column if not exists campus text,
  add column if not exists is_admin boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

-- Admins can also be listed here (used by older ROAM setups).
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

-- Create the profile automatically when someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, consent)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 80),
    coalesce((new.raw_user_meta_data ->> 'consent')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists roam_profile_created on auth.users;  -- older setups: replaced by the trigger below
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Students can't make themselves admins or move schools.
create or replace function public.protect_profile() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_admin := old.is_admin;
    new.school := old.school;
    new.email := old.email;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
      or exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

-- ---------- student-owned data ----------
create table if not exists public.class_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_code text not null check (char_length(course_code) <= 30),
  course_name text check (char_length(course_name) <= 100),
  weekday text not null check (weekday in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  building text check (char_length(building) <= 120),
  room text check (char_length(room) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists class_schedule_user on public.class_schedule (user_id);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('organization','department')),
  name text not null check (char_length(name) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

create table if not exists public.saved_public_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_key text not null check (char_length(event_key) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

-- ---------- posted by the ROAM team / school staff (admins) ----------
create table if not exists public.campus_events (
  id uuid primary key default gen_random_uuid(),
  school text not null default 'georgia-southern',
  title text not null check (char_length(title) <= 200),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at >= starts_at),
  location text,
  link text,
  organization text,
  department text,
  tags text[] not null default '{}',
  published boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.campus_events
  add column if not exists school text not null default 'georgia-southern',
  add column if not exists created_by uuid references auth.users (id) on delete set null;
create index if not exists campus_events_upcoming on public.campus_events (published, ends_at);

create table if not exists public.saved_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.campus_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  school text not null default 'georgia-southern',
  title text not null check (char_length(title) <= 200),
  body text,
  link text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  published boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.announcements
  add column if not exists school text not null default 'georgia-southern',
  add column if not exists link text,
  add column if not exists starts_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users (id) on delete set null;

-- ---------- pilot research ----------
create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(message) <= 2000),
  rating int check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_surveys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phase text not null check (char_length(phase) <= 40),
  discovery int check (discovery between 1 and 5),
  usefulness int check (usefulness between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (char_length(action) <= 40),
  feature text check (char_length(feature) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists activity_events_time on public.activity_events (created_at);

-- ---------- Row Level Security ----------
alter table public.profiles            enable row level security;
alter table public.class_schedule      enable row level security;
alter table public.follows             enable row level security;
alter table public.saved_public_events enable row level security;
alter table public.saved_events        enable row level security;
alter table public.campus_events       enable row level security;
alter table public.announcements       enable row level security;
alter table public.pilot_feedback      enable row level security;
alter table public.pilot_surveys       enable row level security;
alter table public.activity_events     enable row level security;

do $$
declare t text;
begin
  -- profiles: read/update your own; admins can read all (for pilot reports)
  drop policy if exists "own profile read" on public.profiles;
  create policy "own profile read" on public.profiles for select using (id = auth.uid() or public.is_admin());
  drop policy if exists "own profile update" on public.profiles;
  create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

  -- tables a student fully owns
  foreach t in array array['class_schedule','follows','saved_public_events','saved_events'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;

  -- insert-only for students; admins can read for pilot reports
  foreach t in array array['pilot_feedback','pilot_surveys','activity_events'] loop
    execute format('drop policy if exists "own insert" on public.%I', t);
    execute format('create policy "own insert" on public.%I for insert with check (user_id = auth.uid())', t);
    execute format('drop policy if exists "own or admin read" on public.%I', t);
    execute format('create policy "own or admin read" on public.%I for select using (user_id = auth.uid() or public.is_admin())', t);
  end loop;

  -- campus posts: everyone signed in sees published ones; admins manage
  foreach t in array array['campus_events','announcements'] loop
    execute format('drop policy if exists "read published" on public.%I', t);
    execute format('create policy "read published" on public.%I for select using (published or public.is_admin())', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('create policy "admin write" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------- Posting access for campus offices and clubs ----------
-- Admins grant a signed-up account the right to post for one organization or office.
create table if not exists public.org_posters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization text not null check (char_length(organization) between 1 and 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, organization)
);
alter table public.org_posters enable row level security;
grant select, insert, update, delete on public.org_posters to authenticated;

create or replace function public.can_post_for(org text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.org_posters where user_id = auth.uid() and organization = org)
$$;

drop policy if exists "poster read own" on public.org_posters;
create policy "poster read own" on public.org_posters for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin manage posters" on public.org_posters;
create policy "admin manage posters" on public.org_posters for all using (public.is_admin()) with check (public.is_admin());

-- Posters create and manage only their own posts, only for organizations they were granted.
drop policy if exists "poster insert" on public.campus_events;
create policy "poster insert" on public.campus_events for insert
  with check (created_by = auth.uid() and public.can_post_for(organization));
drop policy if exists "poster read own" on public.campus_events;
create policy "poster read own" on public.campus_events for select using (created_by = auth.uid());
drop policy if exists "poster update own" on public.campus_events;
create policy "poster update own" on public.campus_events for update
  using (created_by = auth.uid()) with check (created_by = auth.uid() and public.can_post_for(organization));
drop policy if exists "poster delete own" on public.campus_events;
create policy "poster delete own" on public.campus_events for delete using (created_by = auth.uid());

-- Admin helper: grant posting access by email (the person must have signed up first).
create or replace function public.grant_poster(p_email text, p_org text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Only admins can grant posting access'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No ROAM account uses that email yet. Ask them to sign up first.'; end if;
  insert into public.org_posters (user_id, organization, created_by) values (uid, trim(p_org), auth.uid())
  on conflict (user_id, organization) do nothing;
end $$;
revoke all on function public.grant_poster(text, text) from public, anon;
grant execute on function public.grant_poster(text, text) to authenticated;

-- Admin helper: list posters with their email.
create or replace function public.list_posters() returns table (id uuid, email text, organization text, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select p.id, u.email::text, p.organization, p.created_at
  from public.org_posters p join auth.users u on u.id = p.user_id
  where public.is_admin()
  order by p.organization, u.email
$$;
revoke all on function public.list_posters() from public, anon;
grant execute on function public.list_posters() to authenticated;

-- ---------- API access ----------
-- Signed-in students reach the tables through Supabase's API; the policies above decide which rows.
-- Visitors who are not signed in get no table access at all.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- ---------- "Delete my account" button ----------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();  -- cascades to every table above
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- "I'm going" counts ----------
-- Returns only totals per event, never who is going.
create or replace function public.roam_going_counts() returns table (event_key text, going bigint)
language sql stable security definer set search_path = public as $$
  select event_id::text, count(*) from public.saved_events group by 1
  union all
  select event_key, count(*) from public.saved_public_events group by 1
$$;
revoke all on function public.roam_going_counts() from public, anon;
grant execute on function public.roam_going_counts() to authenticated;

-- ---------- Calendar links ----------
-- Lets ROAM fetch a calendar feed (Google, Outlook, iCloud, georgiasouthern.edu) on a student's
-- or a club's behalf. Personal calendars are fetched and handed back; nothing is stored.
-- Office and club calendars are cached here so every student sees the same events.
create extension if not exists http with schema extensions;

create or replace function public.roam_calendar_url_ok(u text) returns boolean
language sql immutable as $$
  select char_length(u) <= 600
     and u ~* '^https://(calendar\.google\.com|outlook\.office365\.com|outlook\.office\.com|outlook\.live\.com|[a-z0-9-]+\.icloud\.com|calendar\.yahoo\.com|([a-z0-9-]+\.)*georgiasouthern\.edu)/[^[:space:]]+$'
$$;

create or replace function public.roam_fetch_calendar(u text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  link text := regexp_replace(btrim(coalesce(u, '')), '^webcal://', 'https://', 'i');
  code int;
  body text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not public.roam_calendar_url_ok(link) then
    raise exception 'That link is not supported. Use the calendar link from Google, Outlook or Apple.';
  end if;
  begin
    begin perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8'); exception when others then null; end;
    select h.status, h.content into code, body from extensions.http_get(link) h;
  exception when others then
    raise exception 'ROAM could not reach that calendar. Check the link and try again.';
  end;
  if code is distinct from 200 then
    raise exception 'That calendar did not open (code %). Check that the link is the calendar''s own address.', code;
  end if;
  if position('BEGIN:VCALENDAR' in coalesce(body, '')) = 0 then
    raise exception 'That link opened, but it is not a calendar feed.';
  end if;
  return left(body, 3000000);
end $$;
revoke all on function public.roam_fetch_calendar(text) from public, anon;
grant execute on function public.roam_fetch_calendar(text) to authenticated;

create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  school text not null default 'georgia-southern',
  organization text not null check (char_length(organization) between 1 and 200),
  kind text not null default 'organization' check (kind in ('organization','department')),
  url text not null check (char_length(url) <= 600),
  ics text,
  fetched_at timestamptz,
  last_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization, url)
);
alter table public.calendar_feeds enable row level security;
grant select, insert, delete on public.calendar_feeds to authenticated;

drop policy if exists "feed read" on public.calendar_feeds;
create policy "feed read" on public.calendar_feeds for select using (public.can_post_for(organization));
drop policy if exists "feed insert" on public.calendar_feeds;
create policy "feed insert" on public.calendar_feeds for insert
  with check (created_by = auth.uid() and public.can_post_for(organization) and public.roam_calendar_url_ok(url));
drop policy if exists "feed delete" on public.calendar_feeds;
create policy "feed delete" on public.calendar_feeds for delete using (public.can_post_for(organization));

-- Students call this to get the synced office and club calendars. It refreshes up to three
-- calendars that are more than three hours old, then returns every cached calendar.
create or replace function public.roam_feed_events() returns table (feed_id uuid, organization text, kind text, ics text)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  f record;
  code int;
  body text;
begin
  if auth.uid() is null then return; end if;
  for f in
    select c.id, c.url from public.calendar_feeds c
    where c.fetched_at is null or c.fetched_at < now() - interval '3 hours'
    order by c.fetched_at nulls first limit 3
  loop
    begin
      begin perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8'); exception when others then null; end;
      select h.status, h.content into code, body from extensions.http_get(f.url) h;
      if code = 200 and position('BEGIN:VCALENDAR' in coalesce(body, '')) > 0 then
        update public.calendar_feeds c set ics = left(body, 1500000), fetched_at = now(), last_error = null where c.id = f.id;
      else
        update public.calendar_feeds c set fetched_at = now(), last_error = 'The calendar did not open (code ' || coalesce(code::text, '?') || ')' where c.id = f.id;
      end if;
    exception when others then
      update public.calendar_feeds c set fetched_at = now(), last_error = 'ROAM could not reach the calendar' where c.id = f.id;
    end;
  end loop;
  return query select c.id, c.organization, c.kind, c.ics from public.calendar_feeds c where c.ics is not null;
end $$;
revoke all on function public.roam_feed_events() from public, anon;
grant execute on function public.roam_feed_events() to authenticated;

-- To make yourself an admin after you sign up, run this once (replace the email):
-- update public.profiles set is_admin = true where id = (select id from auth.users where email = 'you@georgiasouthern.edu');
