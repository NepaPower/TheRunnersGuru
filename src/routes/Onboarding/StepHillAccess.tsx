import { RadioOption } from '../../components/ui/Form';
import { useApp } from '../../state/AppContext';
import { HILL_ACCESS_OPTIONS } from '../../data/constants';

export function StepHillAccess() {
  const { state, dispatch } = useApp();

  return (
    <>
      <h2 style={{ marginBottom: 'var(--space-1)' }}>Do you have hills or trails near you?</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        Ultra plans lean hard on climbing-specific sessions. If real hills aren't an
        option, we'll swap those sessions for treadmill incline intervals and
        StairMaster work instead.
      </p>
      <div className="stack-3" style={{ marginBottom: 'var(--space-8)' }}>
        {HILL_ACCESS_OPTIONS.map((opt) => (
          <RadioOption
            key={opt.id}
            name="hillaccess"
            checked={state.onboarding.hillAccess === opt.id}
            onChange={() => dispatch({ type: 'ONBOARDING_SELECT_HILL_ACCESS', id: opt.id })}
            label={opt.label}
          />
        ))}
      </div>
    </>
  );
}
