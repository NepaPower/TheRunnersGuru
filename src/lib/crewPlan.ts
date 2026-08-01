/** Predicts elapsed minutes from race start to reach a given mile, assuming
 * even effort proportional to distance across the whole course. This is a
 * deliberately simple model — it does NOT weight harder/easier terrain
 * between aid stations differently, since the parsed GPX summary only
 * carries elevation at named waypoints, not a full per-mile profile. Good
 * enough for a first-pass crew plan; a real grade-adjusted model is a
 * future improvement once we're storing a fuller elevation profile. */
export function predictedElapsedMinutes(mile: number, totalMiles: number, goalFinishMinutes: number): number {
  if (totalMiles <= 0) return 0;
  return Math.round(goalFinishMinutes * (mile / totalMiles));
}

/** Combines a race date + start time (HH:MM) + elapsed minutes into the
 * actual predicted arrival Date object. Returns null if date/time aren't
 * set yet. Shared by the clock-time ETA label and the weather lookups,
 * which both need the real date, not just a display string. */
export function predictedArrivalDate(raceDateStr: string, raceStartTime: string, elapsedMinutes: number): Date | null {
  if (!raceDateStr || !raceStartTime) return null;
  const [h, m] = raceStartTime.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  const start = new Date(raceDateStr + 'T00:00:00');
  start.setHours(h, m, 0, 0);
  return new Date(start.getTime() + elapsedMinutes * 60000);
}

export interface StationTiming {
  elapsedMinutes: number;
  /** The avg min/mile pace actually used for the segment ending at this
   * station — shown as context so it's clear what's currently assumed
   * before someone overrides it. */
  paceUsedMinPerMile: number;
}

/** Computes each station's predicted elapsed minutes from race start,
 * using a segment-by-segment pace rather than one flat average for the
 * whole race. The starting pace is derived from goal finish time ÷ course
 * distance (the "initial" plan). At any station where an avg min/mile
 * override is entered, that pace takes over for every segment AFTER that
 * station — reflecting how the runner is actually doing, not just the
 * original plan — until another station overrides it again. Rest/sleep
 * time at a station still adds on top, delaying every later station the
 * same way regardless of pace. `miles`, `restMinutesByIndex`, and
 * `paceOverrideByIndex` must all be the same length and in course order. */
export function computeStationTimings(
  miles: number[],
  totalMiles: number,
  goalFinishMinutes: number,
  restMinutesByIndex: number[],
  paceOverrideByIndex: (number | null)[],
): StationTiming[] {
  const initialPace = totalMiles > 0 ? goalFinishMinutes / totalMiles : 0;
  const result: StationTiming[] = [];
  let elapsed = 0;
  let currentPace = initialPace;
  let prevMile = 0;
  for (let i = 0; i < miles.length; i++) {
    const segmentDist = Math.max(0, miles[i] - prevMile);
    elapsed += segmentDist * currentPace;
    result.push({ elapsedMinutes: Math.round(elapsed), paceUsedMinPerMile: currentPace });
    elapsed += restMinutesByIndex[i] || 0;
    if (paceOverrideByIndex[i] != null) currentPace = paceOverrideByIndex[i]!;
    prevMile = miles[i];
  }
  return result;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Best-effort parse of a cutoff's weekday + time into minutes-since-race-
 * start — e.g. "Cut Off: Monday, 1:00 PM" with a Friday race start becomes
 * day 3 (Fri→Sat→Sun→Mon) × 1440 + 13:00. Returns null if no weekday or no
 * time could be found in the text. Assumes the cutoff falls within the
 * next 7 days of the race start; races longer than a week would need a
 * different disambiguation, but none currently supported here run that
 * long. */
export function parseCutoffOrderMinutes(cutoffText: string, raceStartWeekdayIndex: number): number | null {
  const weekdayMatch = cutoffText.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (!weekdayMatch) return null;
  const wd = WEEKDAYS.indexOf(weekdayMatch[1].toLowerCase());
  let dayOffset = wd - raceStartWeekdayIndex;
  if (dayOffset < 0) dayOffset += 7;

  const timeMatch = cutoffText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let minutesOfDay = 0;
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    const ap = timeMatch[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    minutesOfDay = h * 60 + m;
  }
  return dayOffset * 1440 + minutesOfDay;
}

/** Combines a race date + start time (HH:MM) + elapsed minutes into a
 * "Saturday 1:57 AM" style display string — the actual weekday rather than
 * a "Day 2" count, since that's what a crew actually needs to know (do I
 * need to be here Saturday night or Sunday morning), not an abstract day
 * number. Returns null if date/time aren't set yet. */
export function formatEtaClock(raceDateStr: string, raceStartTime: string, elapsedMinutes: number): string | null {
  const arrival = predictedArrivalDate(raceDateStr, raceStartTime, elapsedMinutes);
  if (!arrival) return null;
  const weekday = arrival.toLocaleDateString('en-US', { weekday: 'long' });
  const timeLabel = arrival.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${weekday} ${timeLabel}`;
}

/** "14:32/mi" style label for a decimal minutes-per-mile pace value. */
export function formatPaceMinPerMile(minPerMile: number): string {
  const m = Math.floor(minPerMile);
  const s = Math.round((minPerMile - m) * 60);
  const mm = s === 60 ? m + 1 : m;
  const ss = s === 60 ? 0 : s;
  return `${mm}:${String(ss).padStart(2, '0')}/mi`;
}

/** "6h 42m" style label for a minutes duration — used for the elapsed-time
 * column alongside the clock-time ETA. */
export function formatElapsedLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
