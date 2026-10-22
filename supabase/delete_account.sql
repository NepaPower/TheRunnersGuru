-- ─── Let a signed-in person delete their own account ─────────────────────
-- Run once, by hand, in the Supabase SQL editor (project runners-guru) BEFORE
-- the app version with the "Delete my account" button is deployed. Without this
-- function the button shows "isn't switched on yet" and deletes nothing.
--
-- A browser app can't delete a login (auth.users) row itself, so this small,
-- locked-down function does it for the CALLING user only: it takes no arguments
-- and always acts on auth.uid(), so nobody can delete anyone else.
--
-- Deleting the auth user cascades (foreign keys already set up in schema.sql) to
-- profiles, training_plans (and their weekly rows), crew invitations the person
-- sent or received, shared routes, logged runs, matches and chat messages.
-- Feedback rows stay but lose their link to the account (user_id -> null).
-- Uploaded FILES (course images, GPX files) are not database rows, so the app
-- removes those first, through the Storage API, before calling this.
--
-- To check it exists afterwards:
--   select proname from pg_proc
--   where pronamespace = 'public'::regnamespace and proname = 'delete_my_account';
--   (one row = installed)

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- Only signed-in users may call it; anonymous visitors and the public role may not.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
