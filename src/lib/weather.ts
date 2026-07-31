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
