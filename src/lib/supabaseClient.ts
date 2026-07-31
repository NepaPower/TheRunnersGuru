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

export const supabase = createClient(url ?? '', anonKey ?? '');
