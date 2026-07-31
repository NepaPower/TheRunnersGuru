-- Runners Guru — database schema for Supabase (Postgres).
-- Run this in Supabase: Project → SQL Editor → New query → paste → Run.
--
-- Design notes:
--   - auth.users is built into Supabase (handles email/password, sessions).
--     Every table below references it via `user_id uuid references auth.users`.
--   - Row Level Security (RLS) is enabled on every table so the browser can
--     talk to the database directly (via the anon key) while each user only
--     ever sees/writes their own rows. This is what makes it safe to skip a
--     custom backend server for most of this app.
--   - `profiles` is created automatically for every new signup via a trigger
--     (see bottom of file) so you never have to remember to create it
--     client-side after sign-up.

-- ─── profiles ────────────────────────────────────────────────────────────
-- One row per user. Mirrors AuthState + Address from the frontend types.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  street text,
  unit text,
  city text,
  state text,
  zip text,
  phone text,
  garmin_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are editable by owner"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── training_plans ──────────────────────────────────────────────────────
-- One row per user (generated once at the end of onboarding, never
-- regenerated — same rule as the frontend prototype).
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  race_name text not null,
  distance_goal text not null check (distance_goal in ('5k','10k','half','full','ultra')),
  first_time text not null check (first_time in ('yes','no')),
  race_date date not null,
  total_weeks int not null,
  pace text,
  pace_unit text,
  custom_pace text,
  quote text,
  created_at timestamptz not null default now()
);

alter table public.training_plans enable row level security;

create policy "training plans are owner-only"
  on public.training_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── training_plan_weeks ─────────────────────────────────────────────────
-- One row per week per plan — the week-by-week table shown on the
-- Training Plan screen.
create table public.training_plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  week_number int not null,
  phase text not null,
  mon text, tue text, wed text, thu text, fri text, sat text, sun text,
  total_miles numeric not null,
  is_race_week boolean not null default false,
  unique (plan_id, week_number)
);

alter table public.training_plan_weeks enable row level security;

create policy "plan weeks are owner-only via plan"
  on public.training_plan_weeks for all
  using (
    exists (
      select 1 from public.training_plans p
      where p.id = plan_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.training_plans p
      where p.id = plan_id and p.user_id = auth.uid()
    )
  );

-- ─── logged_runs ─────────────────────────────────────────────────────────
-- Replaces the frontend's localStorage persistence.
create table public.logged_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_date date not null,
  distance_miles numeric not null,
  duration_seconds int not null,
  time_of_day text,
  pace_label text,
  temperature_label text,
  electrolytes_count int default 0,
  electrolytes_brand text,
  nutrition_count int default 0,
  nutrition_brand text,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.logged_runs enable row level security;

create policy "logged runs are owner-only"
  on public.logged_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index logged_runs_user_date_idx on public.logged_runs (user_id, run_date desc);

-- ─── matches ─────────────────────────────────────────────────────────────
-- Partner matching. `status` is pending/accepted/passed. Stored as one row
-- per (user, candidate) pair so each user's own pass/match choice is
-- independent of what the other side decides.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','passed')),
  created_at timestamptz not null default now(),
  unique (user_id, candidate_id)
);

alter table public.matches enable row level security;

create policy "matches are owner-only"
  on public.matches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── chat_messages ───────────────────────────────────────────────────────
-- thread_id is the pair of user ids, order-independent — see the app's
-- helper for building it consistently (least/greatest of the two ids).
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "chat messages are readable by sender or recipient"
  on public.chat_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "chat messages are insertable by sender"
  on public.chat_messages for insert
  with check (auth.uid() = sender_id);

create index chat_messages_thread_idx on public.chat_messages (thread_id, created_at);

-- ─── Realtime (optional, for live chat) ─────────────────────────────────
-- Uncomment to let Supabase push new chat messages to connected clients
-- instantly (used for the Chat screen once real users message each other).
-- alter publication supabase_realtime add table public.chat_messages;
