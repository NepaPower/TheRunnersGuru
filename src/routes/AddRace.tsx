import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Form';
import { useApp } from '../state/AppContext';
import { createTrainingPlan, getCurrentUserId } from '../lib/api';
import { parseGpxFile } from '../lib/gpx';
import type { DistanceGoal, GpxRoute, TrainingPlan } from '../types';
import './races.css';

/** The short "Add a race" flow — race name, date, distance, and (for an
 * ultra) the course GPX. Creates a Crew-Plan-only plan (no weekly
 * training schedule; that stays with the primary race). See "My Races"
 * in crew-plan-centerpiece-spec.md. */
export function AddRace() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<'standard' | 'ultra'>('ultra');
  const [standardDistance, setStandardDistance] = useState<Exclude<DistanceGoal, 'ultra'>>('full');
  const [gpxRoute, setGpxRoute] = useState<GpxRoute | null>(null);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleGpx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setGpxError(null);
    setGpxLoading(true);
    try {
      setGpxRoute(await parseGpxFile(file));
    } catch (err) {
      setGpxError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setGpxLoading(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim() || !date) {
      setError('Race name and date are required.');
      return;
    }
    setSaving(true);
    try {
      const userId = state.userId ?? (await getCurrentUserId());
      if (!userId) throw new Error('Not signed in.');
      const plan: TrainingPlan = {
        isPrimary: false,
        raceName: name.trim(),
        distanceGoal: category === 'ultra' ? 'ultra' : standardDistance,
        ultraMiles: category === 'ultra' ? gpxRoute?.distanceMiles ?? null : null,
        firstTime: 'no',
        hillAccess: '',
        gpxRoute: category === 'ultra' ? gpxRoute : null,
        raceDate: date,
        raceStartTime: null,
        goalFinishMinutes: null,
        crewNotes: {},
        courseSegments: null,
        totalWeeks: 0,
        rows: [],
        phases: [],
        quote: '',
      };
      const row = await createTrainingPlan(userId, plan);
      dispatch({ type: 'PLAN_ADDED', plan: { ...plan, id: row.id } });
      navigate(`/crew-plan/${row.id}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'message' in e
            ? String((e as { message: unknown }).message)
            : 'Could not add that race.',
      );
      setSaving(false);
    }
  }

  return (
    <>
      <div className="rg-races-header">
        <div>
          <h2 style={{ marginBottom: 0 }}>Add a race</h2>
          <p className="text-muted" style={{ marginTop: 4 }}>
            This creates a crew plan for the race — aid stations, pacing, weather, segments. It doesn't generate a
            weekly training schedule; that stays with your primary race.
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/races')}>
          ← Back
        </Button>
      </div>

      {error && (
        <div className="rg-auth-error" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Field label="Race name" required>
          <Input type="text" placeholder="e.g. Moab 240" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Race date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="Race type">
          <div className="seg" style={{ maxWidth: 260 }}>
            <label className="seg-opt">
              <input type="radio" name="add-race-cat" checked={category === 'ultra'} onChange={() => setCategory('ultra')} />
              Ultra
            </label>
            <label className="seg-opt">
              <input
                type="radio"
                name="add-race-cat"
                checked={category === 'standard'}
                onChange={() => setCategory('standard')}
              />
              5K–Marathon
            </label>
          </div>
        </Field>

        {category === 'standard' ? (
          <Field label="Distance">
            <Select
              value={standardDistance}
              onChange={(e) => setStandardDistance(e.target.value as Exclude<DistanceGoal, 'ultra'>)}
            >
              <option value="5k">5K</option>
              <option value="10k">10K</option>
              <option value="half">Half marathon</option>
              <option value="full">Marathon</option>
            </Select>
          </Field>
        ) : (
          <Field label="Course GPX" optional hint="Aid stations, cutoffs, elevation and weather all come from this. You can add it later on the Crew Plan screen.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <Button variant="secondary" disabled={gpxLoading} onClick={() => fileInputRef.current?.click()}>
                {gpxLoading ? 'Reading…' : gpxRoute ? 'Replace GPX' : 'Upload GPX'}
              </Button>
              {gpxRoute && (
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {gpxRoute.fileName} — {gpxRoute.distanceMiles} mi, {gpxRoute.waypoints.length} aid station
                  {gpxRoute.waypoints.length === 1 ? '' : 's'}
                </span>
              )}
              <input ref={fileInputRef} type="file" accept=".gpx" onChange={handleGpx} style={{ display: 'none' }} />
            </div>
            {gpxError && (
              <div className="rg-auth-error" style={{ marginTop: 'var(--space-2)' }}>
                {gpxError}
              </div>
            )}
          </Field>
        )}

        <div>
          <Button variant="primary" disabled={saving || !name.trim() || !date} onClick={handleSubmit}>
            {saving ? 'Adding…' : 'Add race'}
          </Button>
        </div>
      </div>
    </>
  );
}
