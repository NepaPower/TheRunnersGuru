-- ─── Race result on My Races (finished + time, DNF, DNS, cancelled) ──────
-- Run once, by hand, in the Supabase SQL editor (project runners-guru) BEFORE
-- the app version that has "How did it go?" on My Races is deployed. The app
-- reads these columns with every plan load, and saving a result writes them.
--
-- race_result: finished | dnf | dns | cancelled. Null = no result recorded yet.
-- race_finish_seconds: the finish time, only meaningful when race_result is
-- 'finished' (null otherwise, and null if the runner left the time out).

alter table public.training_plans
  add column if not exists race_result text
    check (race_result is null or race_result in ('finished', 'dnf', 'dns', 'cancelled')),
  add column if not exists race_finish_seconds int
    check (race_finish_seconds is null or (race_finish_seconds > 0 and race_finish_seconds <= 31536000));

-- Only the person who owns the race may record or change its result. Chief Crew
-- can edit a shared plan's logistics (the existing update policy allows that),
-- so this is enforced in the same before-update trigger that already protects the
-- course setup. The function body below is the existing one plus the new clause.
-- auth.uid() is null for the SQL editor / service role, which stays allowed.
create or replace function public.enforce_course_setup_chief_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.gpx_route is distinct from old.gpx_route
      or new.course_segments is distinct from old.course_segments
      or new.mandatory_gear_image is distinct from old.mandatory_gear_image
      or new.mandatory_gear_notes is distinct from old.mandatory_gear_notes)
     and not public.can_edit_plan_course_setup(old.id) then
    raise exception 'Only the plan owner or Chief Crew can change the course file, segment info, or mandatory gear';
  end if;
  if (new.race_result is distinct from old.race_result
      or new.race_finish_seconds is distinct from old.race_finish_seconds)
     and auth.uid() is not null and auth.uid() is distinct from old.user_id then
    raise exception 'Only the race owner can record the result';
  end if;
  return new;
end;
$$;

-- Check the columns took (two rows = installed):
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'training_plans'
--     and column_name in ('race_result', 'race_finish_seconds');
-- And that the trigger function now knows about them (should return true):
--   select pg_get_functiondef('public.enforce_course_setup_chief_only'::regproc) like '%race_result%';
