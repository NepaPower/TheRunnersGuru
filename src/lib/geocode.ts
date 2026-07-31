/** Shared geocoding helper (Open-Meteo, no API key needed) — used by both
 * the weather lookup and the race search, so a zip only ever gets geocoded
 * one way in this app. */
export interface GeocodedPlace {
  latitude: number;
  longitude: number;
}

export async function geocodeZip(zip: string): Promise<GeocodedPlace | null> {
  if (!zip) return null;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}&count=1&countryCode=US&language=en&format=json`,
    );
    const data = await res.json();
    const place = data?.results?.[0];
    if (!place) return null;
    return { latitude: place.latitude, longitude: place.longitude };
  } catch {
    return null;
  }
}

/** Great-circle distance between two points, in miles (haversine formula). */
export function milesBetween(a: GeocodedPlace, b: GeocodedPlace): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
