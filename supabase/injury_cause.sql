-- ─── Injuries: how it happened (Profile → Background) ────────────────────
-- Run once, by hand, in the Supabase SQL editor (project runners-guru) BEFORE
-- the app version that writes this column is deployed — saving an injury sends
-- the column, and a save to a table without it fails.
--
-- Optional tag on an injury: during a race, during training, not from running,
-- or not sure. Null = not entered (all injuries saved before this existed).

alter table public.runner_injuries
  add column if not exists cause text
    check (cause is null or cause in ('race', 'training', 'other', 'unsure'));

-- Check it took (one row = installed):
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'runner_injuries' and column_name = 'cause';
