-- ─── Running background: past races + injuries (Profile → Background) ────
-- Run once, by hand, in the Supabase SQL editor (project runners-guru) BEFORE
-- the app version with the Background tab is deployed. Without these tables the
-- tab shows an error and saves nothing.
--
-- Both tables are PRIVATE: row-level security lets a person read and write only
-- their own rows. Nothing is ever shown to crew or other runners, and there is
-- deliberately no policy that would allow it (injuries are health information).
-- Rows are removed with the account (on delete cascade from auth.users), so
-- "Delete my account" covers them without changing delete_my_account().

create table if not exists public.runner_past_races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  race_name text not null check (char_length(race_name) between 1 and 120),
  race_date date not null,
  distance_label text not null check (char_length(distance_label) between 1 and 40),
  -- null = time not entered
  finish_seconds int check (finish_seconds is null or (finish_seconds > 0 and finish_seconds <= 31536000)),
  result text not null default 'finished' check (result in ('finished', 'dnf')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

alter table public.runner_past_races enable row level security;

create policy "past races are owner-only"
  on public.runner_past_races for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists runner_past_races_user_date_idx
  on public.runner_past_races (user_id, race_date desc);

create table if not exists public.runner_injuries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body_area text not null check (char_length(body_area) between 1 and 80),
  status text not null default 'current' check (status in ('current', 'past')),
  -- first day of the month it started; null = not entered
  started_on date,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

alter table public.runner_injuries enable row level security;

create policy "injuries are owner-only"
  on public.runner_injuries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists runner_injuries_user_idx
  on public.runner_injuries (user_id, created_at desc);

-- Check both exist (two rows = installed):
--   select tablename from pg_tables
--   where schemaname = 'public' and tablename in ('runner_past_races', 'runner_injuries');
-- And that row-level security is on (both should say true):
--   select relname, relrowsecurity from pg_class
--   where relname in ('runner_past_races', 'runner_injuries');
