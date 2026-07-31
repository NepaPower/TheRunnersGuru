import type { AppState } from '../types';
import { DISTANCE_LABELS, PACES_KM, PACES_MI } from '../data/constants';
import { durationToSeconds, paceLabelPerMile } from '../lib/format';

const DAY_MS = 86400000;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseRunDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : toDateOnly(d);
}

/** Last 7 days (oldest to newest, including today), with total miles logged
 * each day — the actual data behind both the "This week" stat and the
 * Dashboard's mileage chart, so the two can never disagree. */
export function weeklyMileageSeries(state: AppState): { label: string; dateISO: string; miles: number }[] {
  const today = toDateOnly(new Date());
  const byDate = new Map<string, number>();
  for (const run of state.loggedRuns) {
    const d = parseRunDate(run.date);
    if (!d) continue;
    const key = d.toISOString().slice(0, 10);
    byDate.set(key, (byDate.get(key) || 0) + (parseFloat(run.distance) || 0));
  }
  const days: { label: string; dateISO: string; miles: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    days.push({ label: DAY_LABELS[d.getDay()], dateISO: key, miles: Math.round((byDate.get(key) || 0) * 10) / 10 });
  }
  return days;
}

/** Consecutive days up to and including today with at least one logged run
 * — a real streak, not just a count of total runs ever logged. */
function currentStreakDays(state: AppState): number {
  const runDates = new Set(
    state.loggedRuns.map((r) => parseRunDate(r.date)?.toISOString().slice(0, 10)).filter((d): d is string => !!d),
  );
  if (runDates.size === 0) return 0;
  let streak = 0;
  const cursor = toDateOnly(new Date());
  // A streak "counts" through today even if today has no run yet, as long
  // as yesterday does — otherwise logging first thing tomorrow would reset
  // to 0 the moment midnight passes, which reads as unfair to the runner.
  if (!runDates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (runDates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function homeStats(state: AppState) {
  const week = weeklyMileageSeries(state);
  const weekMiles = week.reduce((sum, d) => sum + d.miles, 0);
  const runs = state.loggedRuns;
  const totalSeconds = runs.reduce((sum, r) => sum + durationToSeconds(r.duration), 0);
  const totalMiles = runs.reduce((sum, r) => sum + (parseFloat(r.distance) || 0), 0);
  const avgPaceLabel = paceLabelPerMile(totalMiles, totalSeconds);
  const streak = currentStreakDays(state);
  return [
    { label: 'This week', value: weekMiles > 0 ? weekMiles.toFixed(1) + ' mi' : '0 mi' },
    { label: 'Runs logged', value: String(runs.length) },
    { label: 'Current streak', value: `${streak} day${streak === 1 ? '' : 's'}` },
    { label: 'Avg. pace', value: avgPaceLabel },
  ];
}

export function paceLabel(state: AppState): string {
  const { pace, customPace, paceUnit } = state.onboarding;
  if (pace === 'custom') {
    return customPace ? `${customPace} ${paceUnit === 'km' ? 'min/km' : 'min/mi'}` : 'Set a pace';
  }
  const found = [...PACES_MI, ...PACES_KM].find((p) => p.id === pace);
  return found?.label || 'Set a pace';
}

export function distanceGoalLabel(state: AppState): string {
  return state.onboarding.distanceGoal ? DISTANCE_LABELS[state.onboarding.distanceGoal] : 'Set a goal';
}

export function runElapsedLabel(elapsedSeconds: number): string {
  const mm = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
  const ss = (elapsedSeconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function runPaceLabel(elapsedSeconds: number, distanceMiles: number): string {
  if (distanceMiles <= 0.05) return '—:—';
  const paceMinPerMi = elapsedSeconds / 60 / distanceMiles;
  return `${Math.floor(paceMinPerMi)}:${Math.round((paceMinPerMi % 1) * 60).toString().padStart(2, '0')}/mi`;
}
