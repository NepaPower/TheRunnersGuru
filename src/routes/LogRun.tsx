import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Field, Input, Select, TextArea } from '../components/ui/Form';
import { useApp } from '../state/AppContext';
import { ELECTROLYTE_BRANDS, NUTRITION_BRANDS } from '../data/constants';
import { insertLoggedRun } from '../lib/api';
import { paceLabelFromMinutes } from '../lib/format';
import { mockTemperature } from '../lib/weather';
import './logrun.css';

const DAY_OPTIONS = Array.from({ length: 8 }, (_, i) => i);
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MIN_SEC_OPTIONS = Array.from({ length: 60 }, (_, i) => i);
const COUNT_OPTIONS = Array.from({ length: 6 }, (_, i) => i);

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rg-logrun-section-label">
      <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" fill="none">
        {icon}
      </svg>
      {children}
    </div>
  );
}

export function LogRun() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const f = state.logForm;
  const submitDisabled = !f.distance || !f.date;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    dispatch({ type: 'LOG_FORM_SET_FIELD', field, value: e.target.value });

  async function handleAddRun() {
    if (!state.userId) {
      setError('You need to be signed in to log a run.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const days = Number(f.days), hours = Number(f.hours), minutes = Number(f.minutes), seconds = Number(f.seconds);
      const totalMinutes = days * 24 * 60 + hours * 60 + minutes + seconds / 60;
      const distanceMiles = parseFloat(f.distance) || 0;
      const paceLabel = paceLabelFromMinutes(totalMinutes, distanceMiles);
      const zip = state.auth.address.zip.trim();
      const manualTemp = f.temperature !== '' ? Math.abs(Math.round(Number(f.temperature))) : null;
      const temperatureLabel =
        manualTemp != null ? `${manualTemp}°F` : zip ? 'Looking up…' : `${mockTemperature(f.date, f.timeOfDay)}°F`;

      const run = await insertLoggedRun(state.userId, {
        date: f.date,
        distanceMiles,
        days,
        hours,
        minutes,
        seconds,
        timeOfDay: f.timeOfDay,
        paceLabel,
        temperatureLabel,
        electrolytesCount: Number(f.electrolytesCount),
        electrolytesBrand: f.electrolytesBrand,
        nutritionCount: Number(f.nutritionCount),
        nutritionBrand: f.nutritionBrand,
        comment: f.comment,
      });
      dispatch({ type: 'LOG_RUN_ADDED', run });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this run.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="ghost" className="rg-logrun-back" onClick={() => navigate('/home')}>
        ← Back to summary
      </Button>

      <div className="rg-logrun-card">
        <div className="rg-logrun-title-row">
          <div className="rg-logrun-title-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path d="M12 8v8M8 12h8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Log a run</h3>
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              Add a run you tracked elsewhere.
            </p>
          </div>
        </div>

        <div style={{ height: 'var(--space-4)' }} />

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

        <SectionLabel icon={<><circle cx="12" cy="13" r="8" strokeWidth="2" /><path d="M12 9v4l3 2M9 2h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>}>
          Time taken
        </SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Select value={f.days} onChange={setField('days')}>
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} d</option>
            ))}
          </Select>
          <Select value={f.hours} onChange={setField('hours')}>
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>{h} h</option>
            ))}
          </Select>
          <Select value={f.minutes} onChange={setField('minutes')}>
            {MIN_SEC_OPTIONS.map((m) => (
              <option key={m} value={m}>{m} m</option>
            ))}
          </Select>
          <Select value={f.seconds} onChange={setField('seconds')}>
            {MIN_SEC_OPTIONS.map((s) => (
              <option key={s} value={s}>{s} s</option>
            ))}
          </Select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div>
            <SectionLabel icon={<path d="M13 3L5 13h5l-1 8 8-11h-5l1-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}>
              Gels/Electrolytes
            </SectionLabel>
            <div className="row-2">
              <Select value={f.electrolytesCount} onChange={setField('electrolytesCount')} style={{ maxWidth: 70 }}>
                {COUNT_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Select value={f.electrolytesBrand} onChange={setField('electrolytesBrand')}>
                {ELECTROLYTE_BRANDS.map((b) => (
                  <option key={b} value={b}>{b || 'Select brand'}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <SectionLabel icon={<path d="M12 21c4-3 7-6.5 7-11a7 7 0 10-14 0c0 4.5 3 8 7 11z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}>
              Nutrition
            </SectionLabel>
            <div className="row-2">
              <Select value={f.nutritionCount} onChange={setField('nutritionCount')} style={{ maxWidth: 70 }}>
                {COUNT_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Select value={f.nutritionBrand} onChange={setField('nutritionBrand')}>
                {NUTRITION_BRANDS.map((b) => (
                  <option key={b} value={b}>{b || 'Select brand'}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <Field label="Comments" style={{ marginBottom: 'var(--space-4)' }}>
          <TextArea placeholder="How did it feel?" value={f.comment} onChange={setField('comment')} />
        </Field>

        {error && (
          <div style={{ border: '1px solid var(--color-accent-2-600)', background: 'var(--color-accent-2-100)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)', fontSize: 13, borderRadius: 8 }}>
            {error}
          </div>
        )}

        <Button variant="primary" disabled={submitDisabled || submitting} onClick={handleAddRun}>
          {submitting ? 'Saving…' : 'Add run'}
        </Button>
      </div>

      {state.loggedRuns.length > 0 ? (
        <div className="rg-logrun-table-card">
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
      ) : (
        <div className="rg-logrun-table-card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
          <p className="text-muted" style={{ margin: 0 }}>
            Runs you log will show up here.
          </p>
        </div>
      )}
    </>
  );
}
