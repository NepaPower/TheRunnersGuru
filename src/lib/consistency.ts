import { dayNumber, dayNumberToISO, dayNumberToLabel, mondayOf } from './today';

export interface CalendarDay {
  iso: string;
  dayOfMonth: number;
  runs: number;
  miles: number;
  /** 0 = no run; 1-3 = shorter to longer, by miles that day. */
  level: 0 | 1 | 2 | 3;
  isToday: boolean;
  isFuture: boolean;
  /** "Tuesday, October 6 · 5.2 mi" — for tooltips and screen readers. */
  label: string;
}

/** The last `weeks` Monday-to-Sunday weeks (this one last) as rows of days,
 * marking which days have logged runs, plus how many runs fall in the
 * window. Pure date math on day numbers — no time zones or DST to drift. */
export function consistencyWeeks(
  runs: { date: string; distance: string }[],
  now: Date = new Date(),
  weeks = 4,
): { weeks: CalendarDay[][]; totalRuns: number } {
  const today = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const firstMonday = mondayOf(today) - 7 * (weeks - 1);

  const byDate = new Map<string, { runs: number; miles: number }>();
  for (const r of runs) {
    const entry = byDate.get(r.date) ?? { runs: 0, miles: 0 };
    entry.runs += 1;
    entry.miles += parseFloat(r.distance) || 0;
    byDate.set(r.date, entry);
  }

  let totalRuns = 0;
  const rows: CalendarDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const dayNum = firstMonday + w * 7 + d;
      const iso = dayNumberToISO(dayNum);
      const isFuture = dayNum > today;
      const entry = isFuture ? undefined : byDate.get(iso);
      const miles = entry?.miles ?? 0;
      const level = !entry ? 0 : miles < 3 ? 1 : miles < 8 ? 2 : 3;
      if (entry) totalRuns += entry.runs;
      row.push({
        iso,
        dayOfMonth: Number(iso.slice(8)),
        runs: entry?.runs ?? 0,
        miles,
        level,
        isToday: dayNum === today,
        isFuture,
        label: `${dayNumberToLabel(dayNum)} · ${entry ? `${Math.round(miles * 10) / 10} mi` : isFuture ? 'upcoming' : 'no run'}`,
      });
    }
    rows.push(row);
  }
  return { weeks: rows, totalRuns };
}
