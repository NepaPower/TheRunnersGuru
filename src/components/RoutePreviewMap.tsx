interface TrackPoint {
  lat: number;
  lon: number;
}

/** A small hand-rolled SVG "breadcrumb" line of a route's shape — no
 * mapping library, same approach as WeeklyMileageChart's bar chart.
 * Projects lat/lon onto a flat viewBox (longitude scaled by cos(latitude)
 * so the shape isn't stretched east-west), fit to the box with uniform
 * padding, start marked green and finish gold. `trackPoints` is the
 * downsampled trace from gpx.ts's `includeTrackPreview` option — absent
 * for anything that didn't ask for one, so this renders nothing rather
 * than guessing. */
export function RoutePreviewMap({
  trackPoints,
  width = 320,
  height = 180,
}: {
  trackPoints: TrackPoint[] | undefined;
  width?: number;
  height?: number;
}) {
  if (!trackPoints || trackPoints.length < 2) return null;

  const lats = trackPoints.map((p) => p.lat);
  const lons = trackPoints.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const PAD = 14;
  const spanLat = Math.max(maxLat - minLat, 0.0001);
  const spanLon = Math.max(maxLon - minLon, 0.0001);
  const lonScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180)) || 1;

  const usableW = width - PAD * 2;
  const usableH = height - PAD * 2;
  const scale = Math.min(usableW / (spanLon * lonScale), usableH / spanLat);

  const offsetX = PAD + (usableW - spanLon * lonScale * scale) / 2;
  const offsetY = PAD + (usableH - spanLat * scale) / 2;

  const project = (p: TrackPoint) => ({
    x: offsetX + (p.lon - minLon) * lonScale * scale,
    y: offsetY + (maxLat - p.lat) * scale, // flip: higher latitude (north) draws higher up
  });

  const projected = trackPoints.map(project);
  const pointsAttr = projected.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const start = projected[0];
  const end = projected[projected.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Route shape preview">
      <polyline
        points={pointsAttr}
        fill="none"
        stroke="var(--color-accent-600)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={start.x} cy={start.y} r="4.5" fill="var(--color-accent-600)" stroke="var(--color-bg)" strokeWidth="1.5" />
      <circle cx={end.x} cy={end.y} r="4.5" fill="#d9a441" stroke="var(--color-bg)" strokeWidth="1.5" />
    </svg>
  );
}
