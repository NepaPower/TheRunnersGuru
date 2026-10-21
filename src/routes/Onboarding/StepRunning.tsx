import { Field, Input } from '../../components/ui/Form';
import { useApp } from '../../state/AppContext';

// Digits and one decimal point, at most 5 characters ("12", "7.5").
const cleanMiles = (v: string) => v.replace(/[^0-9.]/g, '').slice(0, 5);

/** "Current running": where the runner is today, so the plan can start there
 * and be honest about how much of a build is realistic before race day. Both
 * answers are optional: blank means plans use fixed per-distance starts. */
export function StepRunning() {
  const { state, dispatch } = useApp();
  const { weeklyMiles, longestRun } = state.onboarding;

  return (
    <>
      <h2 style={{ marginBottom: 'var(--space-1)' }}>How much are you running right now?</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        We start your plan where you are today, and tell you plainly how much of a build is realistic before race day.
        Rough numbers are fine. Just starting out? Enter 0. Not sure? Leave them blank.
      </p>

      <Field label="Miles per week" optional hint="Your average over the last 4 weeks." style={{ marginBottom: 'var(--space-4)' }}>
        <Input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 20"
          value={weeklyMiles}
          onChange={(e) => dispatch({ type: 'ONBOARDING_SET_WEEKLY_MILES', value: cleanMiles(e.target.value) })}
        />
      </Field>
      <Field
        label="Longest single run"
        optional
        hint="In miles, from the last 4 weeks."
        style={{ marginBottom: 'var(--space-8)' }}
      >
        <Input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 8"
          value={longestRun}
          onChange={(e) => dispatch({ type: 'ONBOARDING_SET_LONGEST_RUN', value: cleanMiles(e.target.value) })}
        />
      </Field>
    </>
  );
}
