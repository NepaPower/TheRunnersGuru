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
