import { RadioOption } from '../../components/ui/Form';
import { useApp } from '../../state/AppContext';
import { FIRST_TIME_OPTIONS } from '../../data/constants';

export function StepFirstTime() {
  const { state, dispatch } = useApp();

  return (
    <>
      <h2 style={{ marginBottom: 'var(--space-1)' }}>Are you running this distance for the first time?</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        This helps us set the right pace and mileage ramp.
      </p>
      <div className="stack-3" style={{ marginBottom: 'var(--space-8)' }}>
        {FIRST_TIME_OPTIONS.map((opt) => (
          <RadioOption
            key={opt.id}
            name="firsttime"
            checked={state.onboarding.firstTime === opt.id}
            onChange={() => dispatch({ type: 'ONBOARDING_SELECT_FIRST_TIME', id: opt.id })}
            label={opt.label}
          />
        ))}
      </div>
    </>
  );
}
