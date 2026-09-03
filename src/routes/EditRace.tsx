import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/Form';
import { useApp } from '../state/AppContext';
import { updateRaceDetails } from '../lib/api';
import { buildTrainingPlan } from '../lib/planGenerator';
import { MAX_ULTRA_MILES, ULTRA_DISTANCES } from '../data/constants';
import type { DistanceGoal, FirstTimeAnswer, HillAccessAnswer, TrainingPlan, UltraDistanceId } from '../types';
import './races.css';

type StdDistance = Exclude<DistanceGoal, 'ultra'>;

function ultraIdAndCustomFor(ultraMiles: number | null): { id: UltraDistanceId; custom: string } {
  if (ultraMiles == null) return { id: '', custom: '' };
  const preset = ULTRA_DISTANCES.find((d) => d.miles != null && d.miles === ultraMiles);
  return preset ? { id: preset.id, custom: '' } : { id: 'custom', custom: String(ultraMiles) };
}

export function EditRace() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { planId } = useParams<{ planId: string }>();
  const plan = state.ownPlans.find((p) => p.id === planId);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<'standard' | 'ultra'>('ultra');
  const [stdDistance, setStdDistance] = useState<StdDistance>('full');
  const [ultraId, setUltraId] = useState<UltraDistanceId>('');
  const [ultraCustom, setUltraCustom] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [goalHours, setGoalHours] = useState('');
  const [goalMinutes, setGoalMinutes] = useState('');
  const [firstTime, setFirstTime] = useState<FirstTimeAnswer>('no');
  const [hillAccess, setHillAccess] = useState<HillAccessAnswer>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set after a save that rebuilt the weekly plan — shows a "view the
  // plan" step instead of dropping straight back to My Races.
  const [rebuiltPlan, setRebuiltPlan] = useState(false);

  // Seed the form from the plan. Re-runs if the plan arrives after mount
  // (deep link / refresh, before ownPlans has hydrated).
  useEffect(() => {
    if (!plan) return;
    setName(plan.raceName);
    setCategory(plan.distanceGoal === 'ultra' ? 'ultra' : 'standard');
    setStdDistance(plan.distanceGoal === 'ultra' ? 'full' : (plan.distanceGoal as StdDistance));
    const u = ultraIdAndCustomFor(plan.ultraMiles);
    setUltraId(u.id);
    setUltraCustom(u.custom);
    setRaceDate(plan.raceDate ?? '');
    setGoalHours(plan.goalFinishMinutes != null ? String(Math.floor(plan.goalFinishMinutes / 60)) : '');
    setGoalMinutes(plan.goalFinishMinutes != null ? String(plan.goalFinishMinutes % 60) : '');
    setFirstTime(plan.firstTime || 'no');
    setHillAccess(plan.hillAccess || '');
  }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) {
    return (
      <>
        <Button variant="ghost" onClick={() => navigate('/races')} style={{ marginBottom: 'var(--space-4)' }}>
          ← My Races
        </Button>
        <p className="text-muted">This race isn't loaded. Go back to My Races and open it from there.</p>
      </>
    );
  }

  if (rebuiltPlan) {
    return (
      <>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Training plan rebuilt</h2>
        <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
          “{plan.raceName}” was updated and its weekly schedule regenerated for the new details.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => navigate('/training-plan')}>
            View training plan
          </Button>
          <Button variant="ghost" onClick={() => navigate('/races')}>
            Back to My Races
          </Button>
        </div>
      </>
    );
  }

  const nextUltraMiles: number | null =
    category !== 'ultra'
      ? null
      : ultraId === 'custom'
        ? Number(ultraCustom) > 0
          ? Math.min(Number(ultraCustom), MAX_ULTRA_MILES)
          : null
        : (ULTRA_DISTANCES.find((d) => d.id === ultraId)?.miles ?? null);
  const nextDistanceGoal: DistanceGoal = category === 'ultra' ? 'ultra' : stdDistance;
  const nextHillAccess: HillAccessAnswer = category === 'ultra' ? hillAccess : '';
  const goalFinishMinutes =
    goalHours || goalMinutes ? (Number(goalHours) || 0) * 60 + (Number(goalMinutes) || 0) : null;

  // Fields that change the weekly schedule. Goal time, race name and GPX
  // don't — they save without a rebuild.
  const scheduleChanged =
    nextDistanceGoal !== plan.distanceGoal ||
    nextUltraMiles !== plan.ultraMiles ||
    raceDate !== plan.raceDate ||
    firstTime !== plan.firstTime ||
    nextHillAccess !== (plan.hillAccess || '');
  const willRegenerate = plan.isPrimary && scheduleChanged;

  async function handleSave() {
    setError(null);
    if (!plan || !plan.id) return;
    if (!name.trim() || !raceDate) {
      setError('Race name and date are required.');
      return;
    }
    if (category === 'ultra' && nextUltraMiles == null) {
      setError('Pick an ultra distance (or enter your own).');
      return;
    }
    setSaving(true);
    try {
      let rows = plan.rows;
      let totalWeeks = plan.totalWeeks;
      let phases = plan.phases;
      let quote = plan.quote;
      let gpxRoute = plan.gpxRoute;

      if (willRegenerate) {
        const rebuilt = buildTrainingPlan(
          raceDate,
          nextDistanceGoal,
          firstTime,
          name.trim(),
          nextHillAccess,
          nextUltraMiles,
          plan.gpxRoute,
          goalFinishMinutes,
        );
        if (!rebuilt) throw new Error('Could not rebuild the training plan from those inputs.');
        rows = rebuilt.rows;
        totalWeeks = rebuilt.totalWeeks;
        phases = rebuilt.phases;
        quote = rebuilt.quote;
        gpxRoute = rebuilt.gpxRoute; // null once a plan is no longer an ultra
      } else if (category !== 'ultra') {
        gpxRoute = null;
      }

      const merged: TrainingPlan = {
        ...plan,
        raceName: name.trim(),
        distanceGoal: nextDistanceGoal,
        ultraMiles: nextUltraMiles,
        firstTime,
        hillAccess: nextHillAccess,
        gpxRoute,
        raceDate,
        goalFinishMinutes,
        totalWeeks,
        rows,
        phases,
        quote,
      };

      await updateRaceDetails(plan.id, merged, { regenerateWeeks: willRegenerate });
      dispatch({
        type: 'PLAN_PATCHED',
        planId: plan.id,
        patch: {
          raceName: merged.raceName,
          distanceGoal: merged.distanceGoal,
          ultraMiles: merged.ultraMiles,
          firstTime: merged.firstTime,
          hillAccess: merged.hillAccess,
          gpxRoute: merged.gpxRoute,
          raceDate: merged.raceDate,
          goalFinishMinutes: merged.goalFinishMinutes,
          totalWeeks: merged.totalWeeks,
          rows: merged.rows,
          phases: merged.phases,
          quote: merged.quote,
        },
      });
      if (willRegenerate) {
        setSaving(false);
        setRebuiltPlan(true);
      } else {
        navigate('/races');
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'message' in e
            ? String((e as { message: unknown }).message)
            : 'Could not save those changes.',
      );
      setSaving(false);
    }
  }

  return (
    <>
      <div className="rg-races-header">
        <div>
          <h2 style={{ marginBottom: 0 }}>Edit race details</h2>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Your answers from onboarding.{' '}
            {plan.isPrimary
              ? 'Changing the distance, date, or experience level rebuilds this race’s weekly training schedule.'
              : 'This race is crew-planning only, so there’s no training schedule to rebuild.'}
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
          <Input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Race date" required>
          <Input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
        </Field>

        <Field label="Race type">
          <div className="seg" style={{ maxWidth: 260 }}>
            <label className="seg-opt">
              <input type="radio" name="edit-cat" checked={category === 'ultra'} onChange={() => setCategory('ultra')} />
              Ultra
            </label>
            <label className="seg-opt">
              <input type="radio" name="edit-cat" checked={category === 'standard'} onChange={() => setCategory('standard')} />
              5K–Marathon
            </label>
          </div>
        </Field>

        {category === 'standard' ? (
          <Field label="Distance">
            <Select value={stdDistance} onChange={(e) => setStdDistance(e.target.value as StdDistance)}>
              <option value="5k">5K</option>
              <option value="10k">10K</option>
              <option value="half">Half marathon</option>
              <option value="full">Marathon</option>
            </Select>
          </Field>
        ) : (
          <>
            <Field label="Ultra distance">
              <Select value={ultraId} onChange={(e) => setUltraId(e.target.value as UltraDistanceId)}>
                <option value="">Select…</option>
                {ULTRA_DISTANCES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            {ultraId === 'custom' && (
              <Field label={`Your distance in miles (up to ${MAX_ULTRA_MILES})`}>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={ultraCustom}
                  onChange={(e) => setUltraCustom(e.target.value.replace(/[^\d]/g, ''))}
                />
              </Field>
            )}
            <Field label="Hills or trails nearby?">
              <div className="seg" style={{ maxWidth: 260 }}>
                <label className="seg-opt">
                  <input type="radio" name="edit-hill" checked={hillAccess === 'yes'} onChange={() => setHillAccess('yes')} />
                  Yes
                </label>
                <label className="seg-opt">
                  <input type="radio" name="edit-hill" checked={hillAccess === 'no'} onChange={() => setHillAccess('no')} />
                  No
                </label>
              </div>
            </Field>
          </>
        )}

        <div className="rg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Field label="Goal finish — hours">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 38"
              value={goalHours}
              onChange={(e) => setGoalHours(e.target.value.replace(/[^\d]/g, ''))}
            />
          </Field>
          <Field label="Goal finish — minutes">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={goalMinutes}
              onChange={(e) => setGoalMinutes(e.target.value.replace(/[^\d]/g, ''))}
            />
          </Field>
        </div>

        <Field label="First time at this distance?">
          <div className="seg" style={{ maxWidth: 260 }}>
            <label className="seg-opt">
              <input type="radio" name="edit-first" checked={firstTime === 'yes'} onChange={() => setFirstTime('yes')} />
              Yes
            </label>
            <label className="seg-opt">
              <input type="radio" name="edit-first" checked={firstTime === 'no'} onChange={() => setFirstTime('no')} />
              No
            </label>
          </div>
        </Field>

        {willRegenerate && (
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
            ⚠ These changes will rebuild the weekly training schedule for this race. The Crew Plan (aid stations, notes,
            segments) is untouched.
          </p>
        )}

        <div>
          <Button variant="primary" disabled={saving || !name.trim() || !raceDate} onClick={handleSave}>
            {saving ? 'Saving…' : willRegenerate ? 'Save & rebuild plan' : 'Save changes'}
          </Button>
        </div>
      </div>
    </>
  );
}
