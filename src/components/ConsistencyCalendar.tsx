import type { CalendarDay } from '../lib/consistency';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Four weeks of days as circles: filled where a run was logged (darker for
 * longer days), outlined where not, ringed today. Tapping a past or current
 * day starts logging a run for that date. */
export function ConsistencyCalendar({
  weeks,
  onPickDay,
}: {
  weeks: CalendarDay[][];
  onPickDay: (iso: string) => void;
}) {
  return (
    <div className="rg-dash-cal">
      <div className="rg-dash-cal-head" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0].iso} className="rg-dash-cal-row">
          {week.map((day) => (
            <button
              key={day.iso}
              type="button"
              disabled={day.isFuture}
              className={`rg-dash-cal-day lvl-${day.level}${day.isToday ? ' is-today' : ''}${day.isFuture ? ' is-future' : ''}`}
              aria-label={day.label}
              title={day.label}
              onClick={() => onPickDay(day.iso)}
            >
              {day.dayOfMonth}
            </button>
          ))}
        </div>
      ))}
      <div className="rg-dash-cal-foot">
        <span>Tap a day to log a run.</span>
        <span className="rg-dash-cal-legend" aria-hidden="true">
          Shorter
          <i className="rg-dash-cal-swatch lvl-1" />
          <i className="rg-dash-cal-swatch lvl-2" />
          <i className="rg-dash-cal-swatch lvl-3" />
          Longer
        </span>
      </div>
    </div>
  );
}
