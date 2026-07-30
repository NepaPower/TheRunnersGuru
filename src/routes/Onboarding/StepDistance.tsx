import { Field, Input, RadioOption, Select } from '../../components/ui/Form';
import { Button } from '../../components/ui/Button';
import { useApp } from '../../state/AppContext';
import { DISTANCES, DISTANCE_LABELS, NEARBY_RADIUS_MI } from '../../data/constants';
import { nearbyRaces } from '../../state/reducer';

export function StepDistance() {
  const { state, dispatch } = useApp();
  const { onboarding } = state;
  const hasDistance = !!onboarding.distanceGoal;
  const showPicker = !hasDistance || onboarding.distanceEditing;

  const races = nearbyRaces(onboarding.distanceGoal);
  const isOther = onboarding.raceChoice === '__other__';

  return (
    <>
      <h2 style={{ marginBottom: 'var(--space-1)' }}>What distance are you training for?</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        We'll shape your plan around this.
      </p>

      {hasDistance && !onboarding.distanceEditing && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--color-accent-300)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <span style={{ fontWeight: 600 }}>{DISTANCE_LABELS[onboarding.distanceGoal as keyof typeof DISTANCE_LABELS]}</span>
          <Button variant="ghost" onClick={() => dispatch({ type: 'ONBOARDING_EDIT_DISTANCE' })}>
            Change
          </Button>
        </div>
      )}

      {showPicker && (
        <div className="stack-3" style={{ marginBottom: 'var(--space-8)' }}>
          {DISTANCES.map((opt) => (
            <RadioOption
              key={opt.id}
              name="distance"
              checked={onboarding.distanceGoal === opt.id}
              onChange={() => dispatch({ type: 'ONBOARDING_SELECT_DISTANCE', id: opt.id })}
              label={opt.label}
            />
          ))}
        </div>
      )}

      {hasDistance && (
        <>
          <h6 style={{ marginBottom: 'var(--space-2)' }}>What race are you planning to run?</h6>
          <p className="text-muted" style={{ marginBottom: 'var(--space-4)', fontSize: 13 }}>
            We'll find races within {NEARBY_RADIUS_MI} miles of your address.
          </p>

          {onboarding.raceAddress ? (
            races.length > 0 ? (
              <Field label={`Races near ${onboarding.raceAddress}`} style={{ marginBottom: 'var(--space-4)' }}>
                <Select
                  value={onboarding.raceChoice}
                  onChange={(e) => dispatch({ type: 'ONBOARDING_SET_RACE_CHOICE', value: e.target.value })}
                >
                  <option value="">Select a race…</option>
                  {races.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name} — {r.miles} mi away
                    </option>
                  ))}
                  <option value="__other__">Other / not listed</option>
                </Select>
              </Field>
            ) : (
              <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
                No listed races within {NEARBY_RADIUS_MI} miles of {onboarding.raceAddress} for this distance — enter yours
                below.
              </p>
            )
          ) : (
            <Field label="Your address" style={{ marginBottom: 'var(--space-4)' }}>
              <Input
                type="text"
                placeholder="e.g. 123 Main St, Austin, TX"
                value={onboarding.raceAddress}
                onChange={(e) => dispatch({ type: 'ONBOARDING_SET_RACE_ADDRESS', value: e.target.value })}
              />
            </Field>
          )}

          {(isOther || (races.length === 0 && onboarding.raceAddress)) && (
            <Field label="Race name" style={{ marginBottom: 'var(--space-4)' }}>
              <Input
                type="text"
                placeholder="e.g. Big Sur Marathon"
                value={onboarding.raceName}
                onChange={(e) => dispatch({ type: 'ONBOARDING_SET_RACE_NAME', value: e.target.value })}
              />
            </Field>
          )}
        </>
      )}
    </>
  );
}
