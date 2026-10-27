-- ─── Race result details: miles, time on feet, DNF reason, note ──────────
-- Run once, by hand, in the Supabase SQL editor (project runners-guru) BEFORE
-- the app version that has the extra fields on "How did it go?" is deployed.
-- Run supabase/race_result.sql first if you have not (it adds race_result and
-- race_finish_seconds, which this builds on).
--
-- On My Races (training_plans):
--   race_miles_completed  miles run before a DNF or a mid-race cancellation
--   race_dnf_reason       why, for a DNF
--   race_result_note      a short note
--   race_finish_seconds   (existing) now also holds the time on feet for DNF / cancelled
-- On races added by hand in Profile -> Background (runner_past_races):
--   miles_completed, dnf_reason   (finish_seconds and notes already existed)
-- All optional (null = not entered).

alter table public.training_plans
  add column if not exists race_miles_completed numeric
    check (race_miles_completed is null or (race_miles_completed >= 0 and race_miles_completed <= 1000)),
  add column if not exists race_dnf_reason text
    check (race_dnf_reason is null or race_dnf_reason in ('injury', 'illness', 'cutoff', 'stomach', 'heat_weather', 'fatigue', 'other')),
  add column if not exists race_result_note text
    check (race_result_note is null or char_length(race_result_note) <= 200);

alter table public.runner_past_races
  add column if not exists miles_completed numeric
    check (miles_completed is null or (miles_completed >= 0 and miles_completed <= 1000)),
  add column if not exists dnf_reason text
    check (dnf_reason is null or dnf_reason in ('injury', 'illness', 'cutoff', 'stomach', 'heat_weather', 'fatigue', 'other'));

-- Owner-only, as with the result itself: the existing trigger function, now also
-- covering the three new columns. (Body = the version from race_result.sql plus them.)
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
      or new.race_finish_seconds is distinct from old.race_finish_seconds
      or new.race_miles_completed is distinct from old.race_miles_completed
      or new.race_dnf_reason is distinct from old.race_dnf_reason
      or new.race_result_note is distinct from old.race_result_note)
     and auth.uid() is not null and auth.uid() is distinct from old.user_id then
    raise exception 'Only the race owner can record the result';
  end if;
  return new;
end;
$$;

-- Check the columns took (should return 5 rows: 3 from training_plans, 2 from runner_past_races):
--   select table_name, column_name from information_schema.columns
--   where table_schema = 'public'
--     and ((table_name = 'training_plans' and column_name in ('race_miles_completed', 'race_dnf_reason', 'race_result_note'))
--       or (table_name = 'runner_past_races' and column_name in ('miles_completed', 'dnf_reason')));
-- And that the trigger function covers them (should return true):
--   select pg_get_functiondef('public.enforce_course_setup_chief_only'::regproc) like '%race_dnf_reason%';
