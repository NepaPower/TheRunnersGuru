import { useEffect, useState } from 'react';

/**
 * Offline support, step 2: a single source of truth for connectivity.
 *
 * `navigator.onLine` is only reliably *false* — a `true` can still mean
 * "connected to a wifi network that has no internet". That's acceptable
 * here: everything gated on this (an advisory banner, friendlier error
 * copy, an auto-retry on reconnect) fails safe if `onLine` is optimistic.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

/**
 * True when an error is (or is very likely) a dropped-connection failure
 * rather than a real server response. A failed `fetch` throws a bare
 * `TypeError` — "Failed to fetch" on Chrome, "Load failed" on Safari —
 * with no status; we also treat anything thrown while `navigator.onLine`
 * is false as a network error.
 */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('network') ||
    msg.includes('networkerror') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('connection')
  );
}

/**
 * User-facing message for a caught error: a plain "you're offline" line
 * when it looks like lost connectivity, otherwise the real message (or a
 * caller-supplied fallback). Keeps raw "Load failed" / "TypeError" text
 * off the screen.
 */
export function describeError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isNetworkError(err)) {
    return "You're offline. Reconnect and try again — this needs an internet connection.";
  }
  return err instanceof Error && err.message ? err.message : fallback;
}
