-- ─── Email the developer when someone sends in-app feedback ──────────────
-- Run once, by hand, in the Supabase SQL editor (project runners-guru).
-- This repo is PUBLIC: the API key and the recipient address live in the
-- Vault (step 2), never in this file.
--
-- Setup:
--   1. Resend (resend.com): sign up with the address that should RECEIVE the
--      mail (the free "onboarding@resend.dev" sender can only email the
--      account owner), then create an API key with "Sending access".
--   2. In the SQL editor, run these two lines with your own values:
--        select vault.create_secret('re_YOUR_KEY', 'resend_api_key');
--        select vault.create_secret('you@example.com', 'feedback_notify_email');
--   3. Run the rest of this file.
--
-- pg_net sends the request in the background, and the function swallows its
-- own errors, so a mail problem can never block or fail a feedback insert.
-- If either secret is missing the trigger does nothing.
--
-- To check it worked after sending a test feedback:
--   select id, status_code, error_msg, created
--   from net._http_response order by created desc limit 5;
--   (status_code 200 = Resend accepted it)

create extension if not exists pg_net with schema extensions;

-- Escapes text for the email body and keeps line breaks.
create or replace function public.feedback_html_escape(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(
    replace(replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;'),
    E'\n', '<br>'
  );
$$;

create or replace function public.notify_feedback_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  api_key text;
  notify_to text;
  who text;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into notify_to from vault.decrypted_secrets where name = 'feedback_notify_email';
  if api_key is null or notify_to is null then
    return new;
  end if;

  who := coalesce(nullif(new.user_name, ''), 'Someone');

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || api_key
    ),
    body := jsonb_strip_nulls(jsonb_build_object(
      'from', 'The Runners Guru <onboarding@resend.dev>',
      'to', jsonb_build_array(notify_to),
      'reply_to', new.user_email,
      'subject', '[Runners Guru] ' || new.category || ': ' || left(regexp_replace(new.message, '\s+', ' ', 'g'), 60),
      'html',
        '<p><strong>' || public.feedback_html_escape(new.category) || '</strong> from '
        || public.feedback_html_escape(who)
        || coalesce(' (' || public.feedback_html_escape(new.user_email) || ')', '')
        || '</p>'
        || '<blockquote style="margin:0 0 16px;padding:8px 14px;border-left:4px solid #345a2f;background:#f4f5ee">'
        || public.feedback_html_escape(new.message)
        || '</blockquote>'
        || '<p style="color:#666;font-size:12px">Page: ' || public.feedback_html_escape(new.page)
        || '<br>Sent ' || to_char(new.created_at at time zone 'utc', 'YYYY-MM-DD HH24:MI') || ' UTC'
        || '<br>' || public.feedback_html_escape(new.user_agent) || '</p>'
    ))
  );
  return new;
exception when others then
  raise warning 'notify_feedback_email failed: %', sqlerrm;
  return new;
end;
$$;

-- Only the trigger should ever run these.
revoke all on function public.notify_feedback_email() from public, anon, authenticated;
revoke all on function public.feedback_html_escape(text) from public, anon, authenticated;

drop trigger if exists feedback_notify_email on public.feedback;
create trigger feedback_notify_email
  after insert on public.feedback
  for each row execute function public.notify_feedback_email();
