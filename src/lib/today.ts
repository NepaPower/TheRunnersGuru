import type { TrainingPlan, TrainingPlanRow } from '../types';

const DAY_MS = 86_400_000;
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

// Whole days since 1970-01-01, from a calendar date (month is 1-based).
// Working in day numbers keeps date math free of time-of-day and DST drift.
export function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

// 1970-01-01 was a Thursday (Monday-based index 3).
export const weekdayIndex = (dayNum: number) => (dayNum + 3) % 7;
export const mondayOf = (dayNum: number) => dayNum - weekdayIndex(dayNum);

/** yyyy-mm-dd for a day number (the format logged runs use). */
export function dayNumberToISO(dayNum: number): string {
  return new Date(dayNum * DAY_MS).toISOString().slice(0, 10);
}

export function dayNumberToLabel(dayNum: number): string {
  return new Date(dayNum * DAY_MS).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Today's local date as yyyy-mm-dd (the format logged runs use). */
export function localISODate(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export type TodayPosition =
  | { status: 'before'; startsInDays: number; startDay: number }
  | { status: 'during'; row: TrainingPlanRow; dayIndex: number; text: string; daysToRace: number }
  | { status: 'after'; daysSinceRace: number };

/** Where "today" falls in a plan's weekly schedule. Weeks run Monday to
 * Sunday and the last row is the week that contains race day (see
 * buildTrainingPlan), so a date's week number counts back from race week:
 * the number of whole weeks between its Monday and race week's Monday. */
export function todayInPlan(
  plan: Pick<TrainingPlan, 'raceDate' | 'totalWeeks' | 'rows'>,
  now: Date = new Date(),
): TodayPosition | null {
  if (!plan.raceDate || plan.rows.length === 0) return null;
  const [ry, rm, rd] = plan.raceDate.split('-').map(Number);
  if (!ry || !rm || !rd) return null;

  const raceDay = dayNumber(ry, rm, rd);
  const today = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (today > raceDay) return { status: 'after', daysSinceRace: today - raceDay };

  const raceMonday = mondayOf(raceDay);
  const weeksBeforeRaceWeek = (raceMonday - mondayOf(today)) / 7;
  const weekNumber = plan.totalWeeks - weeksBeforeRaceWeek;

  if (weekNumber < 1) {
    const startDay = raceMonday - (plan.totalWeeks - 1) * 7;
    return { status: 'before', startsInDays: startDay - today, startDay };
  }

  const row = plan.rows.find((r) => r.week === weekNumber);
  if (!row) return null;
  const dayIndex = weekdayIndex(today);
  return { status: 'during', row, dayIndex, text: row[DAY_KEYS[dayIndex]], daysToRace: raceDay - today };
}

export function daysUntil(isoDate: string): number | null {
  if (!isoDate) return null;
  const race = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(race.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((race.getTime() - today.getTime()) / 86_400_000);
}

export function countdownLabel(days: number | null): string {
  if (days == null) return '';
  if (days < 0) return 'past';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 21) return `in ${days} days`;
  if (days < 90) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

const LOCK_GRACE_DAYS = 14;

/** Completed races are locked (no Edit / Delete) once they're more than 14
 * days past — except for 14 days after the race was added, so a race entered
 * with a wrong past date (say the wrong year) can still be fixed or removed.
 * When the creation time is unknown the race is left unlocked rather than
 * risk trapping someone. */
export function isRaceLocked(raceDate: string, createdAt?: string | null, now: Date = new Date()): boolean {
  const days = daysUntil(raceDate);
  if (days == null || days >= -LOCK_GRACE_DAYS) return false;
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const createdDay = dayNumber(created.getFullYear(), created.getMonth() + 1, created.getDate());
  const today = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return today - createdDay > LOCK_GRACE_DAYS;
}

/** True when a yyyy-mm-dd date is before today (today itself is fine). */
export function isPastDate(isoDate: string, now: Date = new Date()): boolean {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return false;
  return dayNumber(y, m, d) < dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
