import { haversineMiles } from './gpx';
import { downsamplePoints, type LatLon } from './routeMap';

export interface ParsedRun {
  fileName: string;
  date: string; // YYYY-MM-DD, local to the browser — see note below
  timeOfDay: string; // "6:30 AM"
  distanceMiles: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  startLat: number | null;
  startLon: number | null;
  routePoints: LatLon[]; // downsampled, for a route-shape thumbnail
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parses a recorded-activity GPX (from Garmin Connect's "Export to GPX",
 * or any watch/app export) into the fields Log a Run needs: date, time of
 * day, distance, and total duration. This is deliberately a separate
 * parser from lib/gpx.ts's course-route one — a recorded activity has a
 * <time> on every point, which is what makes duration/pace computable at
 * all; a planned course file never has this, since it was never actually
 * run.
 *
 * Timezone note: GPX timestamps are UTC. The date/time-of-day extracted
 * here are rendered in whatever timezone the browser itself is set to,
 * not necessarily wherever the run actually happened — the same
 * simplifying assumption used elsewhere in this app (e.g. Crew Plan's
 * race start time). Good enough for someone logging their own run from
 * the place they ran it; would need real timezone metadata (which GPX
 * doesn't reliably carry) to do better.
 *
 * Throws if the file has no timestamps at all — that's the signal it's a
 * course/route file rather than a recorded activity. */
export function parseRunGpxText(xmlText: string, fileName: string): ParsedRun {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error("That file couldn't be read as GPX — please check it's a valid GPX export.");
  }

  const trkptEls = Array.from(doc.getElementsByTagName('trkpt'));
  if (trkptEls.length < 2) {
    throw new Error('No track points found in this GPX file.');
  }

  const points = trkptEls
    .map((el) => {
      const lat = parseFloat(el.getAttribute('lat') || '');
      const lon = parseFloat(el.getAttribute('lon') || '');
      const timeText = el.getElementsByTagName('time')[0]?.textContent;
      const time = timeText ? new Date(timeText) : null;
      return { lat, lon, time: time && !Number.isNaN(time.getTime()) ? time : null };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

  if (points.length < 2) {
    throw new Error('No usable track points found in this GPX file.');
  }

  let distanceMiles = 0;
  for (let i = 1; i < points.length; i++) {
    distanceMiles += haversineMiles(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }

  const timed = points.filter((p) => p.time);
  if (timed.length < 2) {
    throw new Error(
      "This file doesn't have timestamps, so duration and pace can't be read from it — that usually means it's a planned course/route file rather than a recorded activity.",
    );
  }

  const start = timed[0].time!;
  const end = timed[timed.length - 1].time!;
  const totalSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));

  return {
    fileName,
    date: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    timeOfDay: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    startLat: points[0].lat,
    startLon: points[0].lon,
    routePoints: downsamplePoints(
      points.map((p) => ({ lat: p.lat, lon: p.lon })),
      80,
    ),
  };
}

export function parseRunGpxFile(file: File): Promise<ParsedRun> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseRunGpxText(String(reader.result ?? ''), file.name));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Could not parse that GPX file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}
