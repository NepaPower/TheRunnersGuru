import type { LoggedRun } from '../types';
import { dayNumber } from './today';

export interface RecentRunning {
  runs: number;
  /** Average miles per week over the last 4 weeks. */
  weeklyMiles: number;
  /** Longest single run in those 4 weeks, in miles. */
  longestRunMiles: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The "current running" numbers worked out from logged runs: the last 28 days
 * (today and the 27 before it). Returns null when nothing was logged in that
 * window, so the caller can say so instead of filling in zeros. */
export function recentRunning(runs: LoggedRun[], now: Date = new Date()): RecentRunning | null {
  const today = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate());
  let total = 0;
  let longest = 0;
  let count = 0;
  for (const r of runs) {
    const [y, m, d] = r.date.split('-').map(Number);
    if (!y || !m || !d) continue;
    const age = today - dayNumber(y, m, d);
    const miles = parseFloat(r.distance);
    if (age < 0 || age > 27 || !Number.isFinite(miles) || miles <= 0) continue;
    total += miles;
    longest = Math.max(longest, miles);
    count++;
  }
  if (count === 0) return null;
  return { runs: count, weeklyMiles: round1(total / 4), longestRunMiles: round1(longest) };
}
