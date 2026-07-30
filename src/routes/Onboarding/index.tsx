import { useNavigate } from 'react-router-dom';
import { Blueprint } from '../../components/ui/Blueprint';
import { Button } from '../../components/ui/Button';
import { useApp } from '../../state/AppContext';
import { StepDistance } from './StepDistance';
import { StepFirstTime } from './StepFirstTime';
import { StepPace } from './StepPace';
import { StepDateGoal } from './StepDateGoal';

const STEP_LABELS = ['Distance & race', 'First time?', 'Pace', 'Race date & goal'];

export function Onboarding() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const step = state.onboarding.step;

  function handleNext() {
    dispatch({ type: 'ONBOARDING_NEXT' });
    if (step === 3) navigate('/home');
  }

  return (
    <div className="centered-card-page" style={{ background: 'var(--color-bg)' }}>
      <Blueprint style={{ width: 'min(480px, 100%)', border: '1px solid var(--color-divider)', padding: 'var(--space-8) var(--space-6)' }}>
        <div className="row-2" style={{ marginBottom: 'var(--space-6)' }}>
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              title={label}
              style={{ width: 20, height: 3, background: i <= step ? 'var(--color-accent)' : 'var(--color-divider)' }}
            />
          ))}
        </div>

        <h6 className="text-muted" style={{ marginBottom: 'var(--space-2)' }}>
          Step {step + 1} of 4
        </h6>

        {step === 0 && <StepDistance />}
        {step === 1 && <StepFirstTime />}
        {step === 2 && <StepPace />}
        {step === 3 && <StepDateGoal />}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <Button variant="secondary" disabled={step === 0} onClick={() => dispatch({ type: 'ONBOARDING_PREV' })}>
            Back
          </Button>
          <Button variant="primary" onClick={handleNext}>
            {step === 3 ? 'Get started' : 'Next'}
          </Button>
        </div>
      </Blueprint>
    </div>
  );
}
