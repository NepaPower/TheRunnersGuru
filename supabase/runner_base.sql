-- ─── Runner's current running (plan starting point) ─────────────────────
-- Run once, by hand, in the Supabase SQL editor (project runners-guru) BEFORE
-- the app version that writes these columns is deployed — onboarding saves
-- them with every new plan, and a save to a table without the columns fails.
--
-- Onboarding's "Current running" step asks for the average weekly miles and
-- the longest single run over the last 4 weeks. The plan starts from these and
-- its tier (full build / gentler build / hold-and-taper) depends on them.
-- Both are nullable: null = skipped, and plans then use fixed starting points.

alter table public.training_plans
  add column if not exists current_weekly_miles numeric
    check (current_weekly_miles is null or (current_weekly_miles >= 0 and current_weekly_miles <= 500)),
  add column if not exists longest_run_miles numeric
    check (longest_run_miles is null or (longest_run_miles >= 0 and longest_run_miles <= 500));

-- Check it took:
--   select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'training_plans'
--     and column_name in ('current_weekly_miles', 'longest_run_miles');
