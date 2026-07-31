import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { BrandHeader } from '../../components/Logo';
import { useApp } from '../../state/AppContext';
import { buildTrainingPlan } from '../../lib/planGenerator';
import { saveTrainingPlan } from '../../lib/api';
import { StepDistance } from './StepDistance';
import { StepFirstTime } from './StepFirstTime';
import { StepPace } from './StepPace';
import { StepDateGoal } from './StepDateGoal';
import '../auth.css';

const STEP_LABELS = ['Distance & race', 'First time?', 'Pace', 'Race date & goal'];

export function Onboarding() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const step = state.onboarding.step;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNext() {
    if (step < 3) {
      dispatch({ type: 'ONBOARDING_NEXT' });
      return;
    }
    if (!state.userId) {
      setError('You need to be signed in to save a training plan.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const plan = buildTrainingPlan(
        state.onboarding.raceDate,
        state.onboarding.distanceGoal || '5k',
        state.onboarding.firstTime,
        state.onboarding.raceName,
      );
      if (!plan) throw new Error('Missing race date or distance — go back and fill those in.');
      await saveTrainingPlan(state.userId, plan);
      dispatch({ type: 'ONBOARDING_PLAN_SAVED', plan });
      navigate('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your training plan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rg-auth-page">
      <BrandHeader />
      <div className="rg-auth-card" style={{ width: 'min(480px, 100%)' }}>
        <div className="row-2" style={{ marginBottom: 'var(--space-6)' }}>
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              title={label}
              style={{ width: 22, height: 4, borderRadius: 2, background: i <= step ? 'var(--color-accent)' : 'var(--color-divider)' }}
            />
          ))}
        </div>

        <h6 style={{ marginBottom: 'var(--space-2)', color: 'color-mix(in srgb, var(--color-text) 70%, transparent)' }}>
          Step {step + 1} of 4
        </h6>

        {error && <div className="rg-auth-error">{error}</div>}

        {step === 0 && <StepDistance />}
        {step === 1 && <StepFirstTime />}
        {step === 2 && <StepPace />}
        {step === 3 && <StepDateGoal />}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <Button variant="secondary" disabled={step === 0 || saving} onClick={() => dispatch({ type: 'ONBOARDING_PREV' })}>
            Back
          </Button>
          <Button variant="primary" disabled={saving} onClick={handleNext}>
            {saving ? 'Saving…' : step === 3 ? 'Get started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
