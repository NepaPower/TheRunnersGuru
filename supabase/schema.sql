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
-- One row per race a user is planning for. The weekly training schedule
-- (training_plan_weeks) is generated once, for the user's PRIMARY race
-- only; additional races are Crew-Plan-only. See "My Races" in
-- crew-plan-centerpiece-spec.md.
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Exactly one plan per user is the "primary" race — the one the
  -- Training Plan screen shows and the one onboarding creates. Enforced
  -- by training_plans_one_primary_per_user below.
  is_primary boolean not null default false,
  race_name text not null,
  distance_goal text not null check (distance_goal in ('5k','10k','half','full','ultra')),
  first_time text not null check (first_time in ('yes','no')),
  -- Only asked/set when distance_goal = 'ultra'; determines whether
  -- climbing-specific sessions are prescribed as outdoor hills or their
  -- treadmill-incline / StairMaster equivalents. Null for all other distances.
  hill_access text check (hill_access in ('yes','no')),
  -- Parsed summary (distance, elevation gain/loss, named waypoints) of an
  -- optional uploaded race GPX — never the raw file, see lib/gpx.ts. Null
  -- if not provided or not applicable (non-ultra plans).
  gpx_route jsonb,
  race_date date not null,
  -- Set on the Crew Plan screen (not onboarding) since race start time is
  -- often confirmed later than sign-up. HH:MM, 24h.
  race_start_time text,
  -- Total goal finish time in minutes, from onboarding's goal-time step —
  -- used by the Crew Plan screen's aid-station ETA predictions.
  goal_finish_minutes int,
  -- Free-text nutrition/hydration/gear notes per aid station, keyed by
  -- waypoint index (as a string) into gpx_route's waypoints array.
  crew_notes jsonb not null default '{}'::jsonb,
  -- Per-leg course detail (description, ascent/descent, elevation-profile
  -- image URL) as a JSON array, one entry per real aid-station segment,
  -- matched by order. Null when the plan carries no segment data of its
  -- own. Editing will be gated to owner + Chief Crew (an extension of
  -- enforce_gpx_route_chief_only) once the entry UI lands.
  course_segments jsonb,
  -- Soft-lock for Crew Plan editing — set when someone (owner or crew)
  -- has the Crew Plan screen open, so a second person opening it sees a
  -- "someone's editing this" notice and gets a read-only view instead of
  -- silently overwriting whoever's there. Cleared on that person leaving
  -- the page, and treated as expired (ignorable) after
  -- CREW_PLAN_LOCK_TIMEOUT_MS of no heartbeat regardless — see the
  -- crew-plan-lock functions in lib/api.ts — so a crashed tab or dead
  -- phone can never lock everyone else out indefinitely.
  active_editor_user_id uuid references auth.users(id) on delete set null,
  active_editor_name text,
  active_editor_started_at timestamptz,
  total_weeks int not null,
  pace text,
  pace_unit text,
  custom_pace text,
  quote text,
  created_at timestamptz not null default now()
);

-- At most one primary race per user — a partial unique index that only
-- counts rows where is_primary is true, so a second attempt to mark a
-- primary for the same user fails rather than relying on app code.
create unique index training_plans_one_primary_per_user
  on public.training_plans (user_id) where is_primary;

alter table public.training_plans enable row level security;

create policy "training plans are owner-only"
  on public.training_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── crew_plan_access ────────────────────────────────────────────────────
-- Grants a specific person (by email) collaborate access to one plan's
-- Crew Plan screen — NOT the weekly training schedule in
-- training_plan_weeks, which stays owner-only. A row starts 'pending'
-- (crew_user_id unknown yet) and becomes 'accepted' once someone signs in
-- with a matching email — see claimPendingInvites in lib/api.ts, called
-- on every sign-in.
create table public.crew_plan_access (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  crew_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  -- 'chief' is the only role allowed to replace the course GPX file (see
  -- the trigger below) — everything else a crew member can do (notes,
  -- pace, rest times, race timing) is unrestricted by role.
  role text not null default 'crew' check (role in ('crew', 'chief')),
  created_at timestamptz not null default now(),
  unique (plan_id, invited_email)
);

-- Enforces "only one Chief Crew per plan" at the database level — a
-- partial unique index only counts rows where role = 'chief', so a
-- second attempt to insert/update a second chief for the same plan fails
-- outright rather than relying on application code to check first.
create unique index crew_plan_access_one_chief_per_plan on public.crew_plan_access (plan_id) where role = 'chief';

alter table public.crew_plan_access enable row level security;

create policy "owners manage their plan's crew access"
  on public.crew_plan_access for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "crew can see invites addressed to them"
  on public.crew_plan_access for select
  using (crew_user_id = auth.uid() or lower(invited_email) = lower(auth.jwt() ->> 'email'));

create policy "crew can claim their own pending invite"
  on public.crew_plan_access for update
  using (lower(invited_email) = lower(auth.jwt() ->> 'email') and status = 'pending')
  with check (crew_user_id = auth.uid() and status = 'accepted');

-- Separate SELECT/UPDATE policies (in addition to "training plans are
-- owner-only" above — Postgres combines multiple permissive policies for
-- the same command with OR) let an accepted crew member view and edit the
-- plan's Crew Plan fields (race timing, GPX, crew_notes). They get no
-- access to training_plan_weeks — that policy isn't touched, so the
-- weekly training schedule stays owner-only regardless.
create policy "crew members can view shared plans"
  on public.training_plans for select
  using (
    exists (
      select 1 from public.crew_plan_access ca
      where ca.plan_id = training_plans.id and ca.crew_user_id = auth.uid() and ca.status = 'accepted'
    )
  );

create policy "crew members can edit shared plans"
  on public.training_plans for update
  using (
    exists (
      select 1 from public.crew_plan_access ca
      where ca.plan_id = training_plans.id and ca.crew_user_id = auth.uid() and ca.status = 'accepted'
    )
  );

-- Column-level restriction RLS alone can't express (a USING/WITH CHECK
-- clause applies to the whole row, not one column) — a crew member can
-- freely edit race timing and every station's notes via "crew members
-- can edit shared plans" above, but the course-defining columns
-- (gpx_route and course_segments) may only be changed by the plan owner
-- or the plan's one Chief Crew. Enforced by a before-update trigger.

-- Owner or the plan's Chief Crew. security definer so it can read
-- crew_plan_access from inside a trigger or a storage policy regardless
-- of that table's own RLS. Also used by the course-segments bucket.
create or replace function public.can_edit_plan_course_setup(p_plan_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.training_plans p
    where p.id = p_plan_id
      and (
        p.user_id = auth.uid()
        or exists (
          select 1 from public.crew_plan_access ca
          where ca.plan_id = p.id and ca.crew_user_id = auth.uid()
            and ca.status = 'accepted' and ca.role = 'chief'
        )
      )
  );
$$;

-- Owner or ANY accepted crew member — the read-side equivalent, used by
-- the course-segments bucket's SELECT policy.
create or replace function public.can_read_plan(p_plan_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.training_plans p
    where p.id = p_plan_id
      and (
        p.user_id = auth.uid()
        or exists (
          select 1 from public.crew_plan_access ca
          where ca.plan_id = p.id and ca.crew_user_id = auth.uid() and ca.status = 'accepted'
        )
      )
  );
$$;

create or replace function public.enforce_course_setup_chief_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.gpx_route is distinct from old.gpx_route
      or new.course_segments is distinct from old.course_segments)
     and not public.can_edit_plan_course_setup(old.id) then
    raise exception 'Only the plan owner or Chief Crew can change the course file or segment info';
  end if;
  return new;
end;
$$;

-- Replaces the earlier gpx_route-only trigger/function.
drop trigger if exists trg_enforce_gpx_route_chief_only on public.training_plans;
drop function if exists public.enforce_gpx_route_chief_only();

create trigger trg_enforce_course_setup_chief_only
  before update on public.training_plans
  for each row
  execute function public.enforce_course_setup_chief_only();

-- ─── Storage: course-segments bucket ─────────────────────────────────────
-- Elevation-profile images for training_plans.course_segments. Object
-- keys are <plan_id>/<filename>, so a policy can resolve the owning plan
-- from the first path segment. Private bucket — same access rules as the
-- plan itself: any accepted crew can read, only the owner or Chief Crew
-- can write. Served to the client via signed URLs.
insert into storage.buckets (id, name, public)
values ('course-segments', 'course-segments', false)
on conflict (id) do nothing;

create policy "course-segment images: read by plan crew"
  on storage.objects for select
  using (
    bucket_id = 'course-segments'
    and public.can_read_plan(((storage.foldername(name))[1])::uuid)
  );

create policy "course-segment images: insert by owner or chief"
  on storage.objects for insert
  with check (
    bucket_id = 'course-segments'
    and public.can_edit_plan_course_setup(((storage.foldername(name))[1])::uuid)
  );

create policy "course-segment images: update by owner or chief"
  on storage.objects for update
  using (
    bucket_id = 'course-segments'
    and public.can_edit_plan_course_setup(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'course-segments'
    and public.can_edit_plan_course_setup(((storage.foldername(name))[1])::uuid)
  );

create policy "course-segment images: delete by owner or chief"
  on storage.objects for delete
  using (
    bucket_id = 'course-segments'
    and public.can_edit_plan_course_setup(((storage.foldername(name))[1])::uuid)
  );

-- Migration for an already-deployed database (this table already exists in
-- Supabase): run this once in the SQL editor instead of the CREATE TABLE
-- above.
--   alter table public.training_plans add column hill_access text
--     check (hill_access in ('yes','no'));
--   alter table public.training_plan_weeks add column total_hours numeric;
--   alter table public.training_plans add column gpx_route jsonb;
--   alter table public.training_plans add column race_start_time text;
--   alter table public.training_plans add column goal_finish_minutes int;
--   alter table public.training_plans add column crew_notes jsonb not null default '{}'::jsonb;
--   alter table public.training_plans add column course_segments jsonb;
--
--   create table public.crew_plan_access (
--     id uuid primary key default gen_random_uuid(),
--     plan_id uuid not null references public.training_plans(id) on delete cascade,
--     owner_user_id uuid not null references auth.users(id) on delete cascade,
--     invited_email text not null,
--     crew_user_id uuid references auth.users(id) on delete cascade,
--     status text not null default 'pending' check (status in ('pending', 'accepted')),
--     created_at timestamptz not null default now(),
--     unique (plan_id, invited_email)
--   );
--   alter table public.crew_plan_access enable row level security;
--   create policy "owners manage their plan's crew access"
--     on public.crew_plan_access for all
--     using (owner_user_id = auth.uid())
--     with check (owner_user_id = auth.uid());
--   create policy "crew can see invites addressed to them"
--     on public.crew_plan_access for select
--     using (crew_user_id = auth.uid() or lower(invited_email) = lower(auth.jwt() ->> 'email'));
--   create policy "crew can claim their own pending invite"
--     on public.crew_plan_access for update
--     using (lower(invited_email) = lower(auth.jwt() ->> 'email') and status = 'pending')
--     with check (crew_user_id = auth.uid() and status = 'accepted');
--   create policy "crew members can view shared plans"
--     on public.training_plans for select
--     using (
--       exists (
--         select 1 from public.crew_plan_access ca
--         where ca.plan_id = training_plans.id and ca.crew_user_id = auth.uid() and ca.status = 'accepted'
--       )
--     );
--   create policy "crew members can edit shared plans"
--     on public.training_plans for update
--     using (
--       exists (
--         select 1 from public.crew_plan_access ca
--         where ca.plan_id = training_plans.id and ca.crew_user_id = auth.uid() and ca.status = 'accepted'
--       )
--     );
--   alter table public.logged_runs add column route_points jsonb;
--   alter table public.logged_runs add column activity_name text;
--   alter table public.logged_runs add column activity_type text;
--   alter table public.logged_runs add column avg_heart_rate int;
--   alter table public.logged_runs add column max_heart_rate int;
--   alter table public.logged_runs add column min_heart_rate int;
--   alter table public.logged_runs add column avg_cadence int;
--   alter table public.logged_runs add column max_cadence int;
--   alter table public.logged_runs add column elevation_gain_ft int;
--   alter table public.logged_runs add column elevation_loss_ft int;
--
--   alter table public.training_plans add column active_editor_user_id uuid
--     references auth.users(id) on delete set null;
--   alter table public.training_plans add column active_editor_name text;
--   alter table public.training_plans add column active_editor_started_at timestamptz;
--
--   alter table public.crew_plan_access add column role text not null default 'crew'
--     check (role in ('crew', 'chief'));
--   create unique index crew_plan_access_one_chief_per_plan
--     on public.crew_plan_access (plan_id) where role = 'chief';
--   create or replace function public.enforce_gpx_route_chief_only()
--   returns trigger
--   language plpgsql
--   security definer
--   set search_path = public
--   as $$
--   begin
--     if new.gpx_route is distinct from old.gpx_route then
--       if auth.uid() = old.user_id then
--         return new;
--       end if;
--       if exists (
--         select 1 from public.crew_plan_access ca
--         where ca.plan_id = old.id and ca.crew_user_id = auth.uid() and ca.status = 'accepted' and ca.role = 'chief'
--       ) then
--         return new;
--       end if;
--       raise exception 'Only the plan owner or Chief Crew can replace the course GPX file';
--     end if;
--     return new;
--   end;
--   $$;
--   create trigger trg_enforce_gpx_route_chief_only
--     before update on public.training_plans
--     for each row
--     execute function public.enforce_gpx_route_chief_only();
--
--   -- Per-race course segments (slice b): chief-only gating for the new
--   -- course_segments column + a private storage bucket for its images.
--   -- The two helper functions and the trigger use create-or-replace /
--   -- drop-if-exists, so this block is safe to re-run; the four
--   -- create policy statements are not — drop them first if repeating.
--   create or replace function public.can_edit_plan_course_setup(p_plan_id uuid)
--   returns boolean language sql security definer set search_path = public stable as $$
--     select exists (
--       select 1 from public.training_plans p
--       where p.id = p_plan_id and (
--         p.user_id = auth.uid()
--         or exists (select 1 from public.crew_plan_access ca
--           where ca.plan_id = p.id and ca.crew_user_id = auth.uid()
--             and ca.status = 'accepted' and ca.role = 'chief')
--       )
--     );
--   $$;
--   create or replace function public.can_read_plan(p_plan_id uuid)
--   returns boolean language sql security definer set search_path = public stable as $$
--     select exists (
--       select 1 from public.training_plans p
--       where p.id = p_plan_id and (
--         p.user_id = auth.uid()
--         or exists (select 1 from public.crew_plan_access ca
--           where ca.plan_id = p.id and ca.crew_user_id = auth.uid() and ca.status = 'accepted')
--       )
--     );
--   $$;
--   create or replace function public.enforce_course_setup_chief_only()
--   returns trigger language plpgsql security definer set search_path = public as $$
--   begin
--     if (new.gpx_route is distinct from old.gpx_route
--         or new.course_segments is distinct from old.course_segments)
--        and not public.can_edit_plan_course_setup(old.id) then
--       raise exception 'Only the plan owner or Chief Crew can change the course file or segment info';
--     end if;
--     return new;
--   end;
--   $$;
--   drop trigger if exists trg_enforce_gpx_route_chief_only on public.training_plans;
--   drop function if exists public.enforce_gpx_route_chief_only();
--   create trigger trg_enforce_course_setup_chief_only
--     before update on public.training_plans
--     for each row execute function public.enforce_course_setup_chief_only();
--   insert into storage.buckets (id, name, public)
--     values ('course-segments', 'course-segments', false) on conflict (id) do nothing;
--   create policy "course-segment images: read by plan crew" on storage.objects for select
--     using (bucket_id = 'course-segments'
--       and public.can_read_plan(((storage.foldername(name))[1])::uuid));
--   create policy "course-segment images: insert by owner or chief" on storage.objects for insert
--     with check (bucket_id = 'course-segments'
--       and public.can_edit_plan_course_setup(((storage.foldername(name))[1])::uuid));
--   create policy "course-segment images: update by owner or chief" on storage.objects for update
--     using (bucket_id = 'course-segments'
--       and public.can_edit_plan_course_setup(((storage.foldername(name))[1])::uuid))
--     with check (bucket_id = 'course-segments'
--       and public.can_edit_plan_course_setup(((storage.foldername(name))[1])::uuid));
--   create policy "course-segment images: delete by owner or chief" on storage.objects for delete
--     using (bucket_id = 'course-segments'
--       and public.can_edit_plan_course_setup(((storage.foldername(name))[1])::uuid));
--
--   -- Multiple races per account ("My Races"). Drop the one-plan-per-user
--   -- constraint and add the primary-race flag. Backfill: the existing
--   -- single plan per user becomes that user's primary.
--   alter table public.training_plans drop constraint training_plans_user_id_key;
--   alter table public.training_plans add column is_primary boolean not null default false;
--   update public.training_plans set is_primary = true;
--   create unique index training_plans_one_primary_per_user
--     on public.training_plans (user_id) where is_primary;

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
  -- Only set for ultra plans (see generateUltraPlan in planGenerator.ts) —
  -- the Training Plan screen shows this instead of total_miles when
  -- distance_goal = 'ultra'. Null for every other distance.
  total_hours numeric,
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
  -- Downsampled lat/lon path from a GPX import — for a route-shape
  -- thumbnail only, not a full-precision track. Null for manually-entered
  -- runs (no GPX behind them).
  route_points jsonb,
  -- Everything below is device-recorded metadata from a GPX import —
  -- never a manual-entry field. Null for manually-entered runs, or for a
  -- GPX that didn't happen to include that particular data.
  activity_name text,
  activity_type text,
  avg_heart_rate int,
  max_heart_rate int,
  min_heart_rate int,
  avg_cadence int,
  max_cadence int,
  elevation_gain_ft int,
  elevation_loss_ft int,
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
