export function formatRaceDateReadout(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

const MILE_KM = 1.609344;
const STANDARD_RACE_MILES: Record<string, number> = { '5k': 5 / MILE_KM, '10k': 10 / MILE_KM, half: 13.1094, full: 26.2188 };

/** Parses a typed pace — "7:30" (min:sec) or a plain number of minutes
 * ("7", "7.5") — into minutes per unit. Returns null for anything that
 * isn't a plausible running pace (outside 2-20 min per mile/km). */
export function parsePaceMinutes(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  let minutes: number;
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    const mm = Number(m);
    const ss = Number(s);
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss < 0 || ss >= 60) return null;
    minutes = mm + ss / 60;
  } else {
    minutes = Number(t);
  }
  return Number.isFinite(minutes) && minutes >= 2 && minutes <= 20 ? minutes : null;
}

/** Converts a typed pace between per-mile and per-km, returning "m:ss"
 * (7 min/mile -> "4:21" per km). Null if the text isn't a valid pace. */
export function convertPaceText(text: string, from: 'mi' | 'km', to: 'mi' | 'km'): string | null {
  const minutes = parsePaceMinutes(text);
  if (minutes == null) return null;
  const converted = from === to ? minutes : from === 'mi' ? minutes / MILE_KM : minutes * MILE_KM;
  const totalSeconds = Math.round(converted * 60);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/** m:ss, or h:mm:ss from an hour up, from total seconds. */
export function formatClockTime(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Time to cover a standard race distance (5k/10k/half/full) at a steady
 * pace given per mile or per km, as total seconds. Null for any other
 * distance id. */
export function raceSecondsAtPace(distanceId: string, paceMinutes: number, unit: 'mi' | 'km'): number | null {
  const miles = STANDARD_RACE_MILES[distanceId];
  if (miles == null) return null;
  const units = unit === 'km' ? miles * MILE_KM : miles;
  return paceMinutes * units * 60;
}

/** Combines goal-time parts (as the form strings) into the stored value:
 * total minutes, fractional when seconds are present (24:30 -> 24.5).
 * Returns null when every part is blank. */
export function goalPartsToMinutes(hours: string, minutes: string, seconds: string): number | null {
  if (!hours && !minutes && !seconds) return null;
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0) + (Number(seconds) || 0) / 60;
}

/** Inverse of goalPartsToMinutes — splits stored total minutes back into
 * form strings. Rounds to whole seconds first so a fractional value like
 * 24.166666... doesn't come back as 24:09. */
export function goalMinutesToParts(totalMinutes: number | null): { hours: string; minutes: string; seconds: string } {
  if (totalMinutes == null) return { hours: '', minutes: '', seconds: '' };
  const totalSeconds = Math.round(totalMinutes * 60);
  return {
    hours: String(Math.floor(totalSeconds / 3600)),
    minutes: String(Math.floor((totalSeconds % 3600) / 60)),
    seconds: String(totalSeconds % 60),
  };
}

/** Turns a total-hours + minutes goal finish time into a "1 day, 4 hours,
 * 30 minutes" readout — used on the ultra Race date & goal step, where
 * people think in total hours (e.g. "38 hours") but want to see what that
 * means in days. Returns '' if nothing valid has been entered yet. */
export function goalTimeBreakdownLabel(goalHours: string, goalMinutes: string): string {
  const hours = Number(goalHours);
  const minutes = Number(goalMinutes);
  if (!goalHours && !goalMinutes) return '';
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '';
  const totalMinutes = (Number.isNaN(hours) ? 0 : hours) * 60 + (Number.isNaN(minutes) ? 0 : minutes);
  if (totalMinutes <= 0) return '';
  const days = Math.floor(totalMinutes / (24 * 60));
  const remHours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const remMinutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (remHours || days) parts.push(`${remHours} hour${remHours === 1 ? '' : 's'}`);
  parts.push(`${remMinutes} minute${remMinutes === 1 ? '' : 's'}`);
  return parts.join(', ');
}

/** mm:ss (or h:mm:ss / d + h:mm:ss) duration label from total seconds. */
export function formatDurationParts(days: number, hours: number, minutes: number, seconds: number): string {
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  parts.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
  return parts.join(' ');
}

/** Parses the "1d 02:03:04" / "02:03:04" duration format back to total seconds. */
export function durationToSeconds(duration: string): number {
  const dayMatch = duration.match(/(\d+)d/);
  const days = dayMatch ? Number(dayMatch[1]) : 0;
  const clockPart = duration.replace(/\d+d\s*/, '');
  const parts = clockPart.split(':').map(Number);
  if (parts.some(Number.isNaN)) return days * 86400;
  let clockSeconds: number;
  if (parts.length === 3) clockSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) clockSeconds = parts[0] * 60 + parts[1];
  else clockSeconds = parts[0];
  return days * 86400 + clockSeconds;
}

/** "8:32" style pace label from total minutes and miles. */
export function paceLabelFromMinutes(totalMinutes: number, miles: number): string {
  if (miles <= 0) return '—';
  const pace = totalMinutes / miles;
  return `${Math.floor(pace)}:${Math.round((pace % 1) * 60).toString().padStart(2, '0')}`;
}

export function paceLabelPerMile(totalMiles: number, totalSeconds: number): string {
  if (totalMiles <= 0) return '—:—';
  const avgPace = totalSeconds / 60 / totalMiles;
  return `${Math.floor(avgPace)}:${Math.round((avgPace % 1) * 60).toString().padStart(2, '0')}/mi`;
}
