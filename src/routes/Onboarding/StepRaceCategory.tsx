import { RadioOption } from '../../components/ui/Form';
import { useApp } from '../../state/AppContext';

export function StepRaceCategory() {
  const { state, dispatch } = useApp();

  return (
    <>
      <h2 style={{ marginBottom: 'var(--space-1)' }}>What are you training for?</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        Ultra plans work differently — we'll ask a couple of extra questions if that's you.
      </p>
      <div className="stack-3" style={{ marginBottom: 'var(--space-8)' }}>
        <RadioOption
          name="racecategory"
          checked={state.onboarding.raceCategory === 'standard'}
          onChange={() => dispatch({ type: 'ONBOARDING_SELECT_RACE_CATEGORY', category: 'standard' })}
          label="5K to Marathon"
        />
        <RadioOption
          name="racecategory"
          checked={state.onboarding.raceCategory === 'ultra'}
          onChange={() => dispatch({ type: 'ONBOARDING_SELECT_RACE_CATEGORY', category: 'ultra' })}
          label="Ultra marathon (50K+)"
        />
      </div>
    </>
  );
}
