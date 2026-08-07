import { useEffect, useState } from 'react';

interface DayPoint {
  label: string;
  dateISO: string;
  miles: number;
}

/** A small hand-built SVG bar chart — no charting library needed for one
 * simple weekly series. Bars animate in on mount (one deliberate motion
 * moment, not scattered effects). */
export function WeeklyMileageChart({ data }: { data: DayPoint[] }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setTimeout(() => setAnimated(true), 30));
    return () => cancelAnimationFrame(t);
  }, []);

  const max = Math.max(1, ...data.map((d) => d.miles));
  const width = 560;
  const height = 160;
  const barGap = 14;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;
  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <svg viewBox={`0 -16 ${width} ${height + 44}`} width="100%" height={height + 44} role="img" aria-label="Miles run each day for the last 7 days">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={0}
          x2={width}
          y1={height - height * f}
          y2={height - height * f}
          stroke="var(--color-divider)"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      ))}
      {data.map((d, i) => {
        const x = i * (barWidth + barGap);
        const targetH = max > 0 ? (d.miles / max) * (height - 12) : 0;
        const h = animated ? targetH : 0;
        const isToday = d.dateISO === todayISO;
        return (
          <g key={d.dateISO}>
            <rect
              x={x}
              y={height - h}
              width={barWidth}
              height={h}
              rx={5}
              fill={isToday ? 'var(--color-accent-600)' : 'var(--color-accent-300)'}
              style={{ transition: 'height 0.7s cubic-bezier(0.22, 1, 0.36, 1), y 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
            {d.miles > 0 && (
              <text
                x={x + barWidth / 2}
                y={height - h - 8}
                textAnchor="middle"
                fontSize="15"
                fontFamily="var(--font-heading)"
                fontWeight={700}
                fill="var(--color-text)"
                opacity={animated ? 1 : 0}
                style={{ transition: 'opacity 0.4s ease 0.5s' }}
              >
                {d.miles}
              </text>
            )}
            <text
              x={x + barWidth / 2}
              y={height + 20}
              textAnchor="middle"
              fontSize="13"
              fontFamily="var(--font-body)"
              fill={isToday ? 'var(--color-text)' : 'var(--color-neutral-600)'}
              fontWeight={isToday ? 700 : 400}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
