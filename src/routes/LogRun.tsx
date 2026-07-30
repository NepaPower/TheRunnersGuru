import { useNavigate } from 'react-router-dom';
import { Blueprint } from '../components/ui/Blueprint';
import { Button } from '../components/ui/Button';
import { Field, Input, Select, TextArea } from '../components/ui/Form';
import { useApp } from '../state/AppContext';
import { ELECTROLYTE_BRANDS, NUTRITION_BRANDS } from '../data/constants';

const DAY_OPTIONS = Array.from({ length: 8 }, (_, i) => i);
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MIN_SEC_OPTIONS = Array.from({ length: 60 }, (_, i) => i);
const COUNT_OPTIONS = Array.from({ length: 6 }, (_, i) => i);

export function LogRun() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const f = state.logForm;
  const submitDisabled = !f.distance || !f.date;

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    dispatch({ type: 'LOG_FORM_SET_FIELD', field, value: e.target.value });

  return (
    <>
      <Button variant="ghost" onClick={() => navigate('/home')} style={{ marginBottom: 'var(--space-4)' }}>
        ← Back to summary
      </Button>

      <Blueprint className="blueprint-card" style={{ border: '1px solid var(--color-divider)', maxWidth: 520, marginBottom: 'var(--space-6)' }}>
        <h3 style={{ marginBottom: 'var(--space-1)' }}>Log a run</h3>
        <p className="text-muted" style={{ marginBottom: 'var(--space-4)', fontSize: 13 }}>
          Add a run you tracked elsewhere.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Field label="Date" required>
            <Input type="date" value={f.date} onChange={setField('date')} />
          </Field>
          <Field label="Temperature (°F)" optional>
            <Input type="number" step={1} min={0} placeholder="e.g. 68" value={f.temperature} onChange={setField('temperature')} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Field label="Distance (miles)" required>
            <Input type="number" step={0.1} min={0} placeholder="e.g. 5.2" value={f.distance} onChange={setField('distance')} />
          </Field>
          <Field label="Time of day">
            <Input type="text" placeholder="e.g. 6:30 AM" value={f.timeOfDay} onChange={setField('timeOfDay')} />
          </Field>
        </div>

        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 14, fontWeight: 600 }}>Time taken</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Select value={f.days} onChange={setField('days')}>
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} d
              </option>
            ))}
          </Select>
          <Select value={f.hours} onChange={setField('hours')}>
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </Select>
          <Select value={f.minutes} onChange={setField('minutes')}>
            {MIN_SEC_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} m
              </option>
            ))}
          </Select>
          <Select value={f.seconds} onChange={setField('seconds')}>
            {MIN_SEC_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </Select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 14, fontWeight: 600 }}>Gels/Electrolytes</label>
            <div className="row-2">
              <Select value={f.electrolytesCount} onChange={setField('electrolytesCount')} style={{ maxWidth: 70 }}>
                {COUNT_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select value={f.electrolytesBrand} onChange={setField('electrolytesBrand')}>
                {ELECTROLYTE_BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b || 'Select brand'}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 14, fontWeight: 600 }}>Nutrition</label>
            <div className="row-2">
              <Select value={f.nutritionCount} onChange={setField('nutritionCount')} style={{ maxWidth: 70 }}>
                {COUNT_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select value={f.nutritionBrand} onChange={setField('nutritionBrand')}>
                {NUTRITION_BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b || 'Select brand'}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <Field label="Comments" style={{ marginBottom: 'var(--space-4)' }}>
          <TextArea placeholder="How did it feel?" value={f.comment} onChange={setField('comment')} />
        </Field>

        <Button variant="primary" disabled={submitDisabled} onClick={() => dispatch({ type: 'LOG_RUN_ADD' })}>
          Add run
        </Button>
      </Blueprint>

      {state.loggedRuns.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time of Day</th>
                <th>Time</th>
                <th>Distance</th>
                <th>Mins/mile</th>
                <th>Temp</th>
                <th>Gels/Electrolytes</th>
                <th>Nutrition</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {state.loggedRuns.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.timeOfDay || '—'}</td>
                  <td>{r.duration}</td>
                  <td>{r.distance} mi</td>
                  <td>{r.paceLabel}</td>
                  <td>{r.temperature}</td>
                  <td>{r.electrolytes}</td>
                  <td>{r.nutrition}</td>
                  <td>{r.comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
