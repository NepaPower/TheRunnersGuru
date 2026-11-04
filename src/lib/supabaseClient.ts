import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fails loudly at startup rather than silently breaking every DB call —
  // easier to diagnose than a wall of "fetch failed" errors later.
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from your Supabase project settings.',
  );
}

// createClient() throws synchronously on an invalid/empty URL, which would
// crash the whole app at import time (blank white page, easy to mistake
// for a rendering bug) if .env.local isn't set up yet. Fall back to a
// syntactically valid placeholder so the app still boots — actual
// Supabase calls will just fail with a clear network error instead.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key');

/** The user id of the sign-in still saved in this browser, or null if there is none.
 *
 * supabase.getSession() reports "no session" when the one-hour access token has expired and
 * the network is down, because renewing it needs a request. The saved sign-in itself is
 * untouched in that case (only a refresh the server actually rejects removes it), so this
 * reads it directly. Used to keep someone signed in, on their saved copy, when they open the
 * app somewhere with no signal. The key matches the one supabase-js builds from the project URL. */
export function storedSessionUserId(): string | null {
  try {
    const host = new URL(url || 'https://placeholder.supabase.co').hostname.split('.')[0];
    const raw = localStorage.getItem(`sb-${host}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.refresh_token && typeof parsed?.user?.id === 'string' ? parsed.user.id : null;
  } catch {
    return null;
  }
}
