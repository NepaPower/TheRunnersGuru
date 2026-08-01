import type { GpxRoute, GpxWaypoint } from '../types';

const EARTH_RADIUS_MI = 3958.7613;
const METERS_TO_FEET = 3.28084;
// Per-segment elevation-delta threshold below which a change is treated as
// GPS/barometric noise rather than real gain/loss — without this, raw GPS
// elevation jitter can inflate total gain by 2-3x on a long course.
const ELEVATION_NOISE_THRESHOLD_FT = 3;

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface TrackPoint {
  lat: number;
  lon: number;
  elevationFt: number | null;
}

function extractPoints(els: Element[]): TrackPoint[] {
  return els
    .map((el) => {
      const lat = parseFloat(el.getAttribute('lat') || '');
      const lon = parseFloat(el.getAttribute('lon') || '');
      const eleText = el.getElementsByTagName('ele')[0]?.textContent;
      const eleM = eleText ? parseFloat(eleText) : NaN;
      return { lat, lon, elevationFt: Number.isFinite(eleM) ? eleM * METERS_TO_FEET : null };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

/** Parses raw GPX XML text into a route summary — distance, elevation
 * gain/loss, and any named <wpt> waypoints (many official race GPX files
 * use these for aid stations), each matched to the nearest track point to
 * estimate its mile marker. Reads points from <trk>/<trkpt> (a recorded
 * track) if present, falling back to <rte>/<rtept> (a planned route) —
 * official "course" files from race organizers are often exported as
 * routes rather than recorded tracks, and have no <trkpt> at all.
 * Browser-only (uses DOMParser). Throws on malformed XML or a file with no
 * usable points in either form. */
export function parseGpxText(xmlText: string, fileName: string): GpxRoute {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error("That file couldn't be read as GPX — please check it's a valid GPX export.");
  }

  let points = extractPoints(Array.from(doc.getElementsByTagName('trkpt')));
  if (points.length < 2) {
    points = extractPoints(Array.from(doc.getElementsByTagName('rtept')));
  }
  if (points.length < 2) {
    throw new Error('No track or route points found in this GPX file.');
  }

  const cumMiles: number[] = [0];
  let gainFt = 0;
  let lossFt = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    cumMiles.push(cumMiles[i - 1] + haversineMiles(prev.lat, prev.lon, cur.lat, cur.lon));
    if (prev.elevationFt != null && cur.elevationFt != null) {
      const delta = cur.elevationFt - prev.elevationFt;
      if (delta > ELEVATION_NOISE_THRESHOLD_FT) gainFt += delta;
      else if (delta < -ELEVATION_NOISE_THRESHOLD_FT) lossFt += -delta;
    }
  }

  const waypoints: GpxWaypoint[] = Array.from(doc.getElementsByTagName('wpt'))
    .map((el) => {
      const lat = parseFloat(el.getAttribute('lat') || '');
      const lon = parseFloat(el.getAttribute('lon') || '');
      const name = el.getElementsByTagName('name')[0]?.textContent?.trim() || 'Waypoint';
      const eleText = el.getElementsByTagName('ele')[0]?.textContent;
      const eleM = eleText ? parseFloat(eleText) : NaN;
      const elevationFt = Number.isFinite(eleM) ? Math.round(eleM * METERS_TO_FEET) : null;

      let nearestIdx = 0;
      let nearestDist = Infinity;
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        for (let i = 0; i < points.length; i++) {
          const d = haversineMiles(lat, lon, points[i].lat, points[i].lon);
          if (d < nearestDist) {
            nearestDist = d;
            nearestIdx = i;
          }
        }
      }
      return { name, mile: Math.round(cumMiles[nearestIdx] * 10) / 10, elevationFt };
    })
    .sort((a, b) => a.mile - b.mile);

  return {
    fileName,
    distanceMiles: Math.round(cumMiles[cumMiles.length - 1] * 10) / 10,
    elevationGainFt: Math.round(gainFt),
    elevationLossFt: Math.round(lossFt),
    waypoints,
  };
}

/** Reads a File (from an <input type="file"> selection) and parses it as GPX. */
export function parseGpxFile(file: File): Promise<GpxRoute> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseGpxText(String(reader.result ?? ''), file.name));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Could not parse that GPX file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}
