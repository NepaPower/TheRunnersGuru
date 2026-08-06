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

/** Converts a wall-clock date+time as it would read IN A SPECIFIC IANA
 * TIMEZONE into the correct UTC instant — e.g. "2026-11-27" "06:00" in
 * "America/Los_Angeles" becomes the Date representing 6am Pacific on that
 * day, correctly resolving to PST (not PDT) since that's what Nov 27
 * actually is. Uses only the built-in Intl API, no date library needed:
 * builds a naive UTC guess, asks Intl what that instant looks like when
 * rendered in the target zone, and shifts by however far off that
 * rendering was from the wall-clock time we actually wanted. */
function zonedWallTimeToUtc(dateStr: string, hour: number, minute: number, timeZone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(utcGuess)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  // Intl can render midnight as "24" in some locales/environments.
  const renderedHour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  const renderedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), renderedHour, Number(parts.minute), Number(parts.second));
  const driftMs = renderedAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - driftMs);
}

/** Reads a UTC instant's year/month/day/hour AS THEY'D READ in a specific
 * IANA timezone — the read-side counterpart to zonedWallTimeToUtc. Needed
 * anywhere the actual numbers are used (e.g. building a weather API
 * query), since a plain Date's .getHours() etc. always reads back in
 * whatever timezone the browser itself happens to be in, not any
 * timezone the Date was originally constructed for. */
export function getDatePartsInZone(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour };
}

/** Combines a race date + start time (HH:MM) + elapsed minutes into the
 * actual predicted arrival Date object. Returns null if date/time aren't
 * set yet. Shared by the clock-time ETA label and the weather lookups,
 * which both need the real date, not just a display string.
 *
 * `courseTimeZone` (an IANA zone like "America/Los_Angeles", resolved
 * once from the course's own GPS coordinates) anchors the race's start
 * time to where the race actually is — without it, "6:00 AM" would be
 * read in whatever timezone the person viewing the page happens to be
 * in, which is wrong the moment a crew member checks this from a
 * different timezone than the race itself (the normal case, not an edge
 * case, for remote crew). Falls back to the browser's own timezone only
 * while the course zone hasn't resolved yet. */
export function predictedArrivalDate(raceDateStr: string, raceStartTime: string, elapsedMinutes: number, courseTimeZone?: string | null): Date | null {
  if (!raceDateStr || !raceStartTime) return null;
  const [h, m] = raceStartTime.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  const start = courseTimeZone
    ? zonedWallTimeToUtc(raceDateStr, h, m, courseTimeZone)
    : (() => {
        const d = new Date(raceDateStr + 'T00:00:00');
        d.setHours(h, m, 0, 0);
        return d;
      })();
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
 * number. Returns null if date/time aren't set yet. Displays in the
 * course's own timezone (see predictedArrivalDate) so the weekday/time
 * shown is correct for someone checking from anywhere else in the world,
 * not just from the race's own timezone. */
export function formatEtaClock(raceDateStr: string, raceStartTime: string, elapsedMinutes: number, courseTimeZone?: string | null): string | null {
  const arrival = predictedArrivalDate(raceDateStr, raceStartTime, elapsedMinutes, courseTimeZone);
  if (!arrival) return null;
  const tz = courseTimeZone ?? undefined;
  const weekday = arrival.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
  const timeLabel = arrival.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
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
