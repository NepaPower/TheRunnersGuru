import { geocodeZip } from './geocode';

/**
 * Temperature lookup for logged runs. If the runner enters a manual
 * temperature, that always wins (handled by the caller before this is
 * invoked). Otherwise: geocode the signup zip (Open-Meteo geocoding),
 * then pull the historical-or-forecast daily mean temperature for the
 * run's date, in °F. Falls back to a deterministic pseudo-random estimate
 * (labeled "(est.)") if the lookup fails or no zip is on file.
 *
 * Swap `fetchTemperatureForZipAndDate` for a different provider later —
 * everything else in the app only depends on this function's signature.
 */

/** Deterministic fallback so repeat lookups for the same date/time-of-day
 * are stable rather than random on every render. */
export function mockTemperature(date: string, timeOfDay = ''): number {
  let seed = 0;
  const key = (date || '') + (timeOfDay || '');
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  return (seed % 41) + 40; // 40-80°F fallback range
}

export async function fetchTemperatureForZipAndDate(zip: string, dateStr: string): Promise<string> {
  try {
    const place = await geocodeZip(zip);
    if (!place) throw new Error('no geocode result');

    const date = dateStr || new Date().toISOString().slice(0, 10);
    const isPast = new Date(date) < new Date(new Date().toISOString().slice(0, 10));
    const base = isPast ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';

    const wRes = await fetch(
      `${base}?latitude=${place.latitude}&longitude=${place.longitude}&start_date=${date}&end_date=${date}&daily=temperature_2m_mean&temperature_unit=fahrenheit&timezone=auto`,
    );
    const w = await wRes.json();
    const temp = w?.daily?.temperature_2m_mean?.[0];
    if (temp == null) throw new Error('no weather result');
    return `${Math.round(temp)}°F`;
  } catch {
    return `${mockTemperature(dateStr)}°F (est.)`;
  }
}

// ─── Crew Plan: aid-station weather ────────────────────────────────────────
// Same Open-Meteo APIs as above (no key required), but keyed directly by
// lat/lon from the GPX rather than a geocoded zip, since aid stations have
// their own coordinates that can be miles from the runner's home address.

const CLIMATE_YEARS_BACK = 5;
// Open-Meteo's forecast_days=16 returns 16 days starting today (offsets
// 0-15) — see fetchShortRangeForecast.
const FORECAST_HORIZON_DAYS = 16;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export interface ClimateAverage {
  avgHighF: number;
  avgLowF: number;
  yearsUsed: number;
}

export interface ShortRangeForecast {
  tempF: number;
}

/** Historical/climate average high & low for a location and calendar
 * month/day, averaged over the yearsBack years immediately before
 * beforeYear — so for a future race date, that's simply "the last N years
 * that have actually happened," never a date that hasn't occurred yet.
 * One request per year, run in parallel. Returns null only if every
 * year's request failed; a handful of missing years still produces an
 * average from however many succeeded. */
export async function fetchClimateAverage(
  lat: number,
  lon: number,
  month: number,
  day: number,
  beforeYear: number,
  yearsBack: number = CLIMATE_YEARS_BACK,
): Promise<ClimateAverage | null> {
  const years = Array.from({ length: yearsBack }, (_, i) => beforeYear - 1 - i);
  const results = await Promise.all(
    years.map(async (year) => {
      const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
      try {
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const high = data?.daily?.temperature_2m_max?.[0];
        const low = data?.daily?.temperature_2m_min?.[0];
        return typeof high === 'number' && typeof low === 'number' ? { high, low } : null;
      } catch {
        return null;
      }
    }),
  );
  const valid = results.filter((r): r is { high: number; low: number } => r !== null);
  if (valid.length === 0) return null;
  return {
    avgHighF: Math.round(valid.reduce((s, r) => s + r.high, 0) / valid.length),
    avgLowF: Math.round(valid.reduce((s, r) => s + r.low, 0) / valid.length),
    yearsUsed: valid.length,
  };
}

/** Real short-range forecast temperature for a specific wall-clock
 * date/hour at a location. Takes plain date/hour components rather than a
 * Date object and matches them against the API's local-time strings as
 * plain text — this deliberately avoids ever converting between
 * timezones, since both this app's "race start time" and Open-Meteo's
 * `timezone=auto` response are wall-clock local time at the race location.
 * Only call this after confirming isWithinForecastHorizon — there is no
 * such thing as an accurate forecast further out than the model's
 * horizon. */
export async function fetchShortRangeForecast(
  lat: number,
  lon: number,
  year: number,
  month: number,
  day: number,
  hour: number,
): Promise<ShortRangeForecast | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&forecast_days=${FORECAST_HORIZON_DAYS}&temperature_unit=fahrenheit&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const times: string[] = data?.hourly?.time ?? [];
    const temps: number[] = data?.hourly?.temperature_2m ?? [];
    const targetPrefix = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:00`;
    const idx = times.indexOf(targetPrefix);
    if (idx === -1) return null;
    const tempF = temps[idx];
    return typeof tempF === 'number' ? { tempF: Math.round(tempF) } : null;
  } catch {
    return null;
  }
}

/** Whether a wall-clock calendar date falls within the forecast model's
 * horizon of "today" (the browser's local calendar date, as a reasonable
 * stand-in — this is a coarse day-level check, not something that needs
 * timezone precision). Pure calendar-day arithmetic via Date.UTC on
 * Y/M/D components only, so time-of-day never enters the comparison. */
export function isWithinForecastHorizon(year: number, month: number, day: number): boolean {
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUTC = Date.UTC(year, month - 1, day);
  const daysOut = Math.round((targetUTC - todayUTC) / 86400000);
  return daysOut >= 0 && daysOut < FORECAST_HORIZON_DAYS;
}

/** "Jun 27" style label for when a date's forecast will become available
 * (horizon days before the target date) — shown when a station's
 * predicted arrival is currently too far out for a real forecast. */
export function forecastAvailableFromLabel(year: number, month: number, day: number): string {
  const target = new Date(Date.UTC(year, month - 1, day));
  const from = new Date(target.getTime() - (FORECAST_HORIZON_DAYS - 1) * 86400000);
  return from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
