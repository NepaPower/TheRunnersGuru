import type { LoggedRun } from '../types';

/**
 * Logged runs are the one piece of state the prototype persists client-side
 * (so they survive logout/reload while everything else resets). In
 * production this should become a real per-user database table instead —
 * this module exists as the single place to swap that in later.
 */
const LOGGED_RUNS_KEY = 'runnersGuru.loggedRuns';

export function loadLoggedRuns(): LoggedRun[] {
  try {
    const raw = localStorage.getItem(LOGGED_RUNS_KEY);
    return raw ? (JSON.parse(raw) as LoggedRun[]) : [];
  } catch {
    return [];
  }
}

export function saveLoggedRuns(runs: LoggedRun[]): void {
  try {
    localStorage.setItem(LOGGED_RUNS_KEY, JSON.stringify(runs));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail silently,
    // matching the prototype's behavior.
  }
}
