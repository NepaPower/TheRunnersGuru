import type { TrainingPlan, TrainingPlanRow } from '../types';

const DAY_MS = 86_400_000;
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

// Whole days since 1970-01-01, from a calendar date (month is 1-based).
// Working in day numbers keeps date math free of time-of-day and DST drift.
function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

// 1970-01-01 was a Thursday (Monday-based index 3).
const weekdayIndex = (dayNum: number) => (dayNum + 3) % 7;
const mondayOf = (dayNum: number) => dayNum - weekdayIndex(dayNum);

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
