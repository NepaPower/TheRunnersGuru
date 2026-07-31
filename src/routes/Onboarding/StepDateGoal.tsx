import { Field, Input, Select } from '../../components/ui/Form';
import { useApp } from '../../state/AppContext';
import { formatRaceDateReadout } from '../../lib/format';
import { monthsLeftLabel } from '../../lib/planGenerator';

const HOUR_OPTIONS_STANDARD = Array.from({ length: 7 }, (_, i) => String(i));
// Ultra finish times run 24+ hours for 100-milers and multi-day for 200/300
// milers — Days (below) absorbs full days, so Hours only needs to cover the
// remainder within a day.
const HOUR_OPTIONS_ULTRA = Array.from({ length: 24 }, (_, i) => String(i));
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export function StepDateGoal() {
  const { state, dispatch } = useApp();
  const { onboarding } = state;
  const isUltra = onboarding.distanceGoal === 'ultra';
  const months = monthsLeftLabel(onboarding.raceDate);
  const hourOptions = isUltra ? HOUR_OPTIONS_ULTRA : HOUR_OPTIONS_STANDARD;

  return (
    <>
      <h2 style={{ marginBottom: 'var(--space-1)' }}>When is your race, and what's your goal finish time?</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        We'll build your training timeline around this.
      </p>

      <Field label="Race date" style={{ marginBottom: 'var(--space-4)' }}>
        <Input
          type="date"
          value={onboarding.raceDate}
          onChange={(e) => dispatch({ type: 'ONBOARDING_SET_RACE_DATE', value: e.target.value })}
        />
        {onboarding.raceDate && (
          <div className="text-muted" style={{ marginTop: 6, fontSize: 13 }}>
            {formatRaceDateReadout(onboarding.raceDate)}
          </div>
        )}
      </Field>

      <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 14, fontWeight: 600 }}>
        Target goal to finish race
      </label>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isUltra ? '1fr 1fr 1fr' : '1fr 1fr',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        {isUltra && (
          <Field label="Days">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={onboarding.goalDays}
              onChange={(e) => dispatch({ type: 'ONBOARDING_SET_GOAL_DAYS', value: e.target.value.replace(/[^\d]/g, '') })}
            />
          </Field>
        )}
        <Field label="Hours">
          <Select value={onboarding.goalHours} onChange={(e) => dispatch({ type: 'ONBOARDING_SET_GOAL_HOURS', value: e.target.value })}>
            <option value="">—</option>
            {hourOptions.map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Minutes">
          <Select value={onboarding.goalMinutes} onChange={(e) => dispatch({ type: 'ONBOARDING_SET_GOAL_MINUTES', value: e.target.value })}>
            <option value="">—</option>
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} m
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {months && (
        <div style={{ border: '1px solid var(--color-accent-300)', background: 'var(--color-accent-100)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <p style={{ margin: 0 }}>
            You have <strong>{months}</strong> to train if you start next week.
          </p>
        </div>
      )}
    </>
  );
}
