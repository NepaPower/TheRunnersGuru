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

/** "6h 42m" style label for a minutes duration — used for the elapsed-time
 * column alongside the clock-time ETA. */
export function formatElapsedLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
