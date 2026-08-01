import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { BrandHeader } from '../../components/Logo';
import { useApp } from '../../state/AppContext';
import { buildTrainingPlan } from '../../lib/planGenerator';
import { saveTrainingPlan, getCurrentUserId } from '../../lib/api';
import { ultraDistanceMiles } from '../../lib/ultraDistance';
import { StepRaceCategory } from './StepRaceCategory';
import { StepDistance } from './StepDistance';
import { StepHillAccess } from './StepHillAccess';
import { StepFirstTime } from './StepFirstTime';
import { StepPace } from './StepPace';
import { StepDateGoal } from './StepDateGoal';
import { onboardingStepLabels } from '../../lib/onboardingSteps';
import '../auth.css';

export function Onboarding() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const step = state.onboarding.step;
  const isUltra = state.onboarding.raceCategory === 'ultra';
  const STEP_LABELS = onboardingStepLabels(state.onboarding.raceCategory);
  const lastStep = STEP_LABELS.length - 1;
  // Step 0 (Race type) and Step 1 (Distance & race) are always the same
  // positions; everything after shifts by one once Hill access is inserted
  // for ultra.
  const distanceStep = 1;
  const hillAccessStep = 2;
  const firstTimeStep = isUltra ? 3 : 2;
  const paceStep = isUltra ? 4 : 3;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNext() {
    if (step < lastStep) {
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
      // A "row-level security policy" rejection on this save specifically
      // means Supabase's auth.uid() didn't match the user_id being written
      // — i.e. there's no valid, current session, even though local state
      // still has a userId cached from earlier (e.g. an unconfirmed email
      // signup, or a session that expired mid-onboarding). Re-check the
      // live session right before saving instead of trusting the cached
      // value, so this fails with a clear message instead of a raw
      // Postgres RLS error.
      const liveUserId = await getCurrentUserId();
      if (!liveUserId) {
        throw new Error("Your session isn't active — please sign in again before finishing setup.");
      }
      const plan = buildTrainingPlan(
        state.onboarding.raceDate,
        state.onboarding.distanceGoal || '5k',
        state.onboarding.firstTime,
        state.onboarding.raceName,
        state.onboarding.hillAccess,
        isUltra ? ultraDistanceMiles(state.onboarding) : null,
        isUltra ? state.onboarding.gpxRoute : null,
      );
      if (!plan) throw new Error('Missing race date or distance — go back and fill those in.');
      await saveTrainingPlan(liveUserId, plan);
      dispatch({ type: 'ONBOARDING_PLAN_SAVED', plan });
      navigate('/home');
    } catch (e) {
      // Supabase's PostgrestError isn't an instanceof Error, so the old
      // `e instanceof Error` check silently swallowed the real reason
      // (missing column, check-constraint violation, etc.) behind a
      // generic message. Surface whatever message/detail is actually
      // available instead.
      const message =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'message' in e
            ? String((e as { message: unknown }).message)
            : 'Could not save your training plan.';
      setError(message);
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
          Step {step + 1} of {STEP_LABELS.length}
        </h6>

        {error && <div className="rg-auth-error">{error}</div>}

        {step === 0 && <StepRaceCategory />}
        {step === distanceStep && <StepDistance />}
        {isUltra && step === hillAccessStep && <StepHillAccess />}
        {step === firstTimeStep && <StepFirstTime />}
        {step === paceStep && <StepPace />}
        {step === lastStep && <StepDateGoal />}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <Button variant="secondary" disabled={step === 0 || saving} onClick={() => dispatch({ type: 'ONBOARDING_PREV' })}>
            Back
          </Button>
          <Button variant="primary" disabled={saving} onClick={handleNext}>
            {saving ? 'Saving…' : step === lastStep ? 'Get started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
