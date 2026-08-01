import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Field, Input, TextArea } from '../components/ui/Form';
import { useApp } from '../state/AppContext';
import { updateCrewPlan } from '../lib/api';
import { formatEtaClock, formatElapsedLabel, predictedElapsedMinutes } from '../lib/crewPlan';
import type { CrewNoteEntry } from '../types';
import './crewplan.css';

const emptyNote: CrewNoteEntry = { nutrition: '', hydration: '', gear: '' };

export function CrewPlan() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const plan = state.trainingPlan;

  const [raceStartTime, setRaceStartTime] = useState(plan?.raceStartTime ?? '');
  const [goalHours, setGoalHours] = useState(plan?.goalFinishMinutes != null ? String(Math.floor(plan.goalFinishMinutes / 60)) : '');
  const [goalMinutes, setGoalMinutes] = useState(plan?.goalFinishMinutes != null ? String(plan.goalFinishMinutes % 60) : '');
  const [notes, setNotes] = useState<Record<string, CrewNoteEntry>>(plan?.crewNotes ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!plan) {
    return (
      <>
        <Button variant="ghost" onClick={() => navigate('/home')} style={{ marginBottom: 'var(--space-4)' }}>
          ← Back to summary
        </Button>
        <p className="text-muted">No training plan yet — finish onboarding to generate one.</p>
      </>
    );
  }

  const waypoints = plan.gpxRoute?.waypoints ?? [];
  const totalMiles = plan.gpxRoute?.distanceMiles ?? 0;
  const goalFinishMinutes = goalHours || goalMinutes ? (Number(goalHours) || 0) * 60 + (Number(goalMinutes) || 0) : null;

  function updateNote(key: string, field: keyof CrewNoteEntry, value: string) {
    setNotes((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyNote), [field]: value } }));
    setSaved(false);
  }

  async function handleSave() {
    if (!state.userId) return;
    setSaving(true);
    try {
      await updateCrewPlan(state.userId, { raceStartTime: raceStartTime || null, goalFinishMinutes, crewNotes: notes });
      dispatch({ type: 'TRAINING_PLAN_UPDATED', patch: { raceStartTime: raceStartTime || null, goalFinishMinutes, crewNotes: notes } });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={() => navigate('/home')} style={{ marginBottom: 'var(--space-4)' }}>
        ← Back to summary
      </Button>

      <div className="rg-cp-header-card">
        <div className="rg-cp-header-top">
          <div className="rg-cp-race-name">Crew Plan for {plan.raceName}</div>
          {plan.gpxRoute && (
            <div className="text-muted">
              {plan.gpxRoute.distanceMiles} mi course · {plan.gpxRoute.elevationGainFt.toLocaleString()} ft gain ·{' '}
              {plan.gpxRoute.elevationLossFt.toLocaleString()} ft loss
            </div>
          )}
        </div>

        <div className="rg-cp-setup-grid">
          <Field label="Race start time">
            <Input
              type="time"
              value={raceStartTime}
              onChange={(e) => {
                setRaceStartTime(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <Field label="Goal finish — hours">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 38"
              value={goalHours}
              onChange={(e) => {
                setGoalHours(e.target.value.replace(/[^\d]/g, ''));
                setSaved(false);
              }}
            />
          </Field>
          <Field label="Goal finish — minutes">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={goalMinutes}
              onChange={(e) => {
                setGoalMinutes(e.target.value.replace(/[^\d]/g, ''));
                setSaved(false);
              }}
            />
          </Field>
        </div>
      </div>

      {waypoints.length === 0 ? (
        <div className="rg-cp-empty-card">
          <p className="text-muted" style={{ marginBottom: 'var(--space-3)' }}>
            {plan.gpxRoute
              ? "Your uploaded GPX didn't include any named aid stations, so there's nothing to plan against yet. Some race organizers publish aid stations as a separate GPX from the main course file — worth checking for one."
              : "No GPX was uploaded for this race, so there are no aid stations to plan against yet."}
          </p>
          <Button variant="secondary" onClick={() => navigate('/training-plan')}>
            Back to Training Plan
          </Button>
        </div>
      ) : (
        <>
          <p className="text-muted" style={{ marginBottom: 'var(--space-4)', fontSize: 13 }}>
            {goalFinishMinutes
              ? 'Predicted arrival times assume even effort across the whole course — treat these as a starting estimate, not a guarantee, especially on technical terrain.'
              : 'Enter a goal finish time above to see predicted arrival times at each aid station.'}
          </p>

          <div className="rg-cp-stations">
            {waypoints.map((wp, i) => {
              const key = String(i);
              const note = notes[key] ?? emptyNote;
              const elapsed = goalFinishMinutes != null ? predictedElapsedMinutes(wp.mile, totalMiles, goalFinishMinutes) : null;
              const eta = elapsed != null && raceStartTime ? formatEtaClock(plan.raceDate, raceStartTime, elapsed) : null;
              return (
                <div key={key} className="rg-cp-station-card">
                  <div className="rg-cp-station-head">
                    <div>
                      <div className="rg-cp-station-name">{wp.name}</div>
                      <div className="text-muted" style={{ fontSize: 13 }}>
                        Mile {wp.mile}
                        {wp.elevationFt != null ? ` · ${wp.elevationFt.toLocaleString()} ft` : ''}
                      </div>
                    </div>
                    {elapsed != null && (
                      <div className="rg-cp-station-eta">
                        <div className="rg-cp-eta-value">{eta ?? formatElapsedLabel(elapsed)}</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {eta ? `+${formatElapsedLabel(elapsed)}` : 'set start time for clock time'}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rg-cp-station-notes">
                    <Field label="Nutrition">
                      <TextArea rows={2} value={note.nutrition} onChange={(e) => updateNote(key, 'nutrition', e.target.value)} />
                    </Field>
                    <Field label="Hydration">
                      <TextArea rows={2} value={note.hydration} onChange={(e) => updateNote(key, 'hydration', e.target.value)} />
                    </Field>
                    <Field label="Gear change">
                      <TextArea rows={2} value={note.gear} onChange={(e) => updateNote(key, 'gear', e.target.value)} />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rg-cp-save-footer">
            <Button variant="primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save crew plan'}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
