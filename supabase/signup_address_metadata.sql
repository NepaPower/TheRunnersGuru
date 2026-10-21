-- ─── Save the sign-up address when the account is created ────────────────
-- Run once, by hand, in the Supabase SQL editor (project runners-guru).
--
-- With "Confirm email" on, signUp() returns no session, so the app can't write
-- the person's address to `profiles` itself (and they may confirm on another
-- device). The sign-up form now sends the address as user metadata
-- (name, street, unit, city, state, zip, phone) and this trigger function
-- copies it into the new profile row. Backward compatible: a sign-up without
-- those keys behaves exactly as before.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, street, unit, city, state, zip, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    nullif(new.raw_user_meta_data->>'street', ''),
    nullif(new.raw_user_meta_data->>'unit', ''),
    nullif(new.raw_user_meta_data->>'city', ''),
    nullif(new.raw_user_meta_data->>'state', ''),
    nullif(new.raw_user_meta_data->>'zip', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;

-- The trigger itself (on_auth_user_created) already exists and is unchanged.
