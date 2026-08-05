import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select, TextArea } from '../components/ui/Form';
import { useApp } from '../state/AppContext';
import { ELECTROLYTE_BRANDS, NUTRITION_BRANDS } from '../data/constants';
import { insertLoggedRun, updateLoggedRun, deleteLoggedRun } from '../lib/api';
import { emptyLogForm } from '../state/reducer';
import { paceLabelFromMinutes } from '../lib/format';
import { mockTemperature, fetchTemperatureForCoordsAndDate } from '../lib/weather';
import { parseRunGpxFile, type ParsedRun } from '../lib/runGpx';
import { buildRoutePath, type LatLon } from '../lib/routeMap';
import type { LoggedRun } from '../types';
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

/** Small route-shape preview — same projection used for the logged-runs
 * table thumbnails below, just larger. Shape only, no basemap (see
 * lib/routeMap.ts). */
function RoutePreview({ points, width, height }: { points: LatLon[]; width: number; height: number }) {
  const d = buildRoutePath(points, width, height);
  if (!d) return null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke="var(--color-accent-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface RunMetaFields {
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  avgCadence?: number | null;
  elevationGainFt?: number | null;
  elevationLossFt?: number | null;
}

/** Compact read-only summary of a run's device-recorded metadata — never
 * editable, since none of this is something a person would type in
 * themselves (nobody knows their own heart rate down to the bpm). Used
 * both in the import preview and the logged-runs table's Details column. */
function MetaSummary({ run }: { run: RunMetaFields }) {
  const parts: string[] = [];
  if (run.avgHeartRate != null) parts.push(`HR ${run.avgHeartRate} avg${run.maxHeartRate != null ? ` (max ${run.maxHeartRate})` : ''}`);
  if (run.avgCadence != null) parts.push(`Cadence ${run.avgCadence} spm`);
  if (run.elevationGainFt != null) parts.push(`+${run.elevationGainFt}/-${run.elevationLossFt ?? 0} ft`);
  if (parts.length === 0) return <span className="text-muted">—</span>;
  return <>{parts.join(' · ')}</>;
}

export function LogRun() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const f = state.logForm;
  const submitDisabled = !f.distance || !f.date;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const [gpxMeta, setGpxMeta] = useState<ParsedRun | null>(null);
  const [gpxTempLoading, setGpxTempLoading] = useState(false);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LoggedRun | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  const setField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    dispatch({ type: 'LOG_FORM_SET_FIELD', field, value: e.target.value });

  async function handleGpxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setGpxError(null);
    setGpxLoading(true);
    setGpxMeta(null);
    try {
      const run = await parseRunGpxFile(file);
      dispatch({
        type: 'LOG_FORM_SET_MANY',
        fields: {
          date: run.date,
          timeOfDay: run.timeOfDay,
          distance: String(run.distanceMiles),
          days: String(run.days),
          hours: String(run.hours),
          minutes: String(run.minutes),
          seconds: String(run.seconds),
        },
      });
      setGpxMeta(run);
      setGpxLoading(false);

      // Temperature at the run's actual coordinates — more accurate than
      // the home-zip fallback the manual-entry path uses, since a run
      // (especially while traveling or racing) may not have happened at
      // home. Runs after the fields above are already filled in, so
      // there's no reason to make the person wait on it.
      if (run.startLat != null && run.startLon != null) {
        setGpxTempLoading(true);
        try {
          const label = await fetchTemperatureForCoordsAndDate(run.startLat, run.startLon, run.date);
          const digits = label.match(/-?\d+/)?.[0];
          if (digits) dispatch({ type: 'LOG_FORM_SET_FIELD', field: 'temperature', value: digits });
        } finally {
          setGpxTempLoading(false);
        }
      }
    } catch (err) {
      setGpxError(err instanceof Error ? err.message : "Couldn't read that file.");
      setGpxLoading(false);
    }
  }

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

      const input = {
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
        routePoints: gpxMeta?.routePoints,
        activityName: gpxMeta?.activityName ?? undefined,
        activityType: gpxMeta?.activityType ?? undefined,
        avgHeartRate: gpxMeta?.avgHeartRate ?? undefined,
        maxHeartRate: gpxMeta?.maxHeartRate ?? undefined,
        minHeartRate: gpxMeta?.minHeartRate ?? undefined,
        avgCadence: gpxMeta?.avgCadence ?? undefined,
        maxCadence: gpxMeta?.maxCadence ?? undefined,
        elevationGainFt: gpxMeta?.elevationGainFt ?? undefined,
        elevationLossFt: gpxMeta?.elevationLossFt ?? undefined,
      };

      if (editingRunId) {
        // preserveGpxMetadata=true unless a fresh GPX was uploaded during
        // this edit session — otherwise editing, say, just the comment on
        // a GPX-imported run would silently wipe its heart rate/cadence/
        // route data by writing nulls over it.
        const run = await updateLoggedRun(editingRunId, input, gpxMeta === null);
        dispatch({ type: 'LOG_RUN_UPDATED', run });
      } else {
        const run = await insertLoggedRun(state.userId, input);
        dispatch({ type: 'LOG_RUN_ADDED', run });
      }
      setGpxMeta(null);
      setEditingRunId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this run.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleEditRun(run: LoggedRun) {
    dispatch({
      type: 'LOG_FORM_SET_MANY',
      fields: {
        date: run.date,
        distance: String(run.raw.distanceMiles),
        days: String(run.raw.days),
        hours: String(run.raw.hours),
        minutes: String(run.raw.minutes),
        seconds: String(run.raw.seconds),
        timeOfDay: run.raw.timeOfDay,
        temperature: run.raw.temperature,
        electrolytesCount: String(run.raw.electrolytesCount),
        electrolytesBrand: run.raw.electrolytesBrand,
        nutritionCount: String(run.raw.nutritionCount),
        nutritionBrand: run.raw.nutritionBrand,
        comment: run.raw.comment,
      },
    });
    setEditingRunId(run.id);
    setGpxMeta(null);
    setGpxError(null);
    setError(null);
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleCancelEdit() {
    setEditingRunId(null);
    setGpxMeta(null);
    dispatch({ type: 'LOG_FORM_SET_MANY', fields: emptyLogForm });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLoggedRun(deleteTarget.id);
      dispatch({ type: 'LOG_RUN_DELETED', id: deleteTarget.id });
      if (editingRunId === deleteTarget.id) handleCancelEdit();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this run.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button variant="ghost" className="rg-logrun-back" onClick={() => navigate('/home')}>
        ← Back to summary
      </Button>

      <div className="rg-logrun-card" ref={formCardRef}>
        <div className="rg-logrun-title-row">
          <div className="rg-logrun-title-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path d="M12 8v8M8 12h8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0 }}>{editingRunId ? 'Edit run' : 'Log a run'}</h3>
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              {editingRunId ? 'Update the details below, then save.' : 'Add a run you tracked elsewhere.'}
            </p>
          </div>
        </div>

        <div style={{ height: 'var(--space-4)' }} />

        <div
          style={{
            border: '1px solid var(--color-accent-300)',
            background: 'var(--color-accent-100)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Import from GPX</div>
            <div className="text-muted" style={{ fontSize: 13, wordBreak: 'break-word' }}>
              {gpxMeta
                ? `Filled in from ${gpxMeta.fileName} — check the fields below, then adjust anything that's off.${gpxTempLoading ? ' Looking up temperature…' : ''}`
                : 'From Garmin Connect, Strava, or any watch export — fills in date, time, distance, duration, temperature, and (when the device recorded it) heart rate, cadence, and elevation.'}
            </div>
            {gpxMeta && f.distance && (Number(f.days) || Number(f.hours) || Number(f.minutes) || Number(f.seconds)) ? (
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent-700)', marginTop: 4 }}>
                {paceLabelFromMinutes(
                  Number(f.days) * 24 * 60 + Number(f.hours) * 60 + Number(f.minutes) + Number(f.seconds) / 60,
                  parseFloat(f.distance) || 0,
                )}{' '}
                avg pace
              </div>
            ) : null}
            {gpxMeta && (gpxMeta.avgHeartRate != null || gpxMeta.avgCadence != null || gpxMeta.elevationGainFt != null) && (
              <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                <MetaSummary run={gpxMeta} />
              </div>
            )}
          </div>
          {gpxMeta && gpxMeta.routePoints.length > 1 && (
            <div style={{ flex: 'none', border: '1px solid var(--color-divider)', borderRadius: 8, background: 'var(--color-bg)', padding: 4 }}>
              <RoutePreview points={gpxMeta.routePoints} width={100} height={70} />
            </div>
          )}
          <Button variant="secondary" disabled={gpxLoading} onClick={() => fileInputRef.current?.click()}>
            {gpxLoading ? 'Reading file…' : 'Upload GPX'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".gpx" onChange={handleGpxImport} style={{ display: 'none' }} />
        </div>
        <p className="text-muted" style={{ fontSize: 12, marginTop: -8, marginBottom: 'var(--space-4)' }}>
          Why upload instead of "Connect Garmin"? No subscription fees, and it works with any device — Garmin, Coros,
          Suunto, Polar, whatever you're running with.
        </p>
        {gpxError && (
          <div
            style={{
              border: '1px solid var(--color-accent-2-600)',
              background: 'var(--color-accent-2-100)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              fontSize: 13,
              borderRadius: 8,
            }}
          >
            {gpxError}
          </div>
        )}

        <div className="rg-grid-2" style={{ marginBottom: 'var(--space-4)' }}>
          <Field label="Date" required>
            <Input type="date" value={f.date} onChange={setField('date')} />
          </Field>
          <Field label="Temperature (°F)" optional>
            <Input type="number" step={1} min={0} placeholder="e.g. 68" value={f.temperature} onChange={setField('temperature')} />
          </Field>
        </div>

        <div className="rg-grid-2" style={{ marginBottom: 'var(--space-4)' }}>
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
        <div className="rg-grid-4" style={{ marginBottom: 'var(--space-4)' }}>
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

        <div className="rg-grid-2" style={{ marginBottom: 'var(--space-4)' }}>
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

        <div className="row-2">
          <Button variant="primary" disabled={submitDisabled || submitting} onClick={handleAddRun}>
            {submitting ? 'Saving…' : editingRunId ? 'Save changes' : 'Add run'}
          </Button>
          {editingRunId && (
            <Button variant="ghost" disabled={submitting} onClick={handleCancelEdit}>
              Cancel
            </Button>
          )}
        </div>
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
                <th>Route</th>
                <th>Details</th>
                <th>Gels/Electrolytes</th>
                <th>Nutrition</th>
                <th>Comments</th>
                <th>Actions</th>
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
                  <td>
                    {r.routePoints && r.routePoints.length > 1 ? (
                      <RoutePreview points={r.routePoints} width={60} height={40} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    <MetaSummary run={r} />
                  </td>
                  <td>{r.electrolytes}</td>
                  <td>{r.nutrition}</td>
                  <td>{r.comment || '—'}</td>
                  <td>
                    <div className="row-2" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      <Button variant="ghost" onClick={() => handleEditRun(r)}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => setDeleteTarget(r)}>
                        Delete
                      </Button>
                    </div>
                  </td>
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

      {deleteTarget && (
        <Dialog
          title="Delete this run?"
          onDismiss={() => !deleting && setDeleteTarget(null)}
          actions={
            <>
              <Button variant="secondary" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={deleting} onClick={handleConfirmDelete}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            {deleteTarget.date} — {deleteTarget.distance} mi will be permanently removed. This can't be undone.
          </p>
        </Dialog>
      )}
    </>
  );
}
