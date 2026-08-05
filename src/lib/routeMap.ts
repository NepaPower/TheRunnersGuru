export interface LatLon {
  lat: number;
  lon: number;
}

/** Projects a lat/lon point path into an SVG path "d" string that fits a
 * given viewBox, preserving the route's actual shape and aspect ratio
 * (not stretched to fill a square). For a run-length route (a few miles),
 * a simple equirectangular projection — longitude scaled by cos(latitude)
 * to correct for the earth's curvature — is accurate enough; there's no
 * need for a real map projection at this scale. Padding keeps the route
 * from touching the edges of whatever it's drawn into.
 *
 * This draws the route's shape only — no basemap/streets/tiles, since
 * that would require a paid mapping API. Good enough for "what did this
 * run look like" at a glance; not a substitute for a real map. */
export function buildRoutePath(points: LatLon[], viewW: number, viewH: number, padding = 8): string | null {
  if (points.length < 2) return null;

  const avgLatRad = (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
  const lonScale = Math.cos(avgLatRad);

  const xs = points.map((p) => p.lon * lonScale);
  const ys = points.map((p) => -p.lat); // flip: latitude increases northward, SVG y increases downward

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;

  const availW = viewW - padding * 2;
  const availH = viewH - padding * 2;
  const scale = Math.min(availW / spanX, availH / spanY);

  // Center the route within the viewBox rather than pinning to a corner.
  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offsetX = padding + (availW - drawnW) / 2;
  const offsetY = padding + (availH - drawnH) / 2;

  const coords = points.map((_, i) => {
    const x = offsetX + (xs[i] - minX) * scale;
    const y = offsetY + (ys[i] - minY) * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M${coords.join(' L')}`;
}

/** Downsamples a point path to at most maxPoints, keeping the first and
 * last points and evenly spacing the rest — for storing a route thumbnail
 * shape without keeping every one of a GPX file's (often thousands of)
 * raw trackpoints. */
export function downsamplePoints(points: LatLon[], maxPoints = 80): LatLon[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const result: LatLon[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.round(i * step)]);
  }
  return result;
}
