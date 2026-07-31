export function formatRaceDateReadout(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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
