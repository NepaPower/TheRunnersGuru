import { Field, Input, RadioOption, SegOption } from '../../components/ui/Form';
import { useApp } from '../../state/AppContext';
import { PACES_KM, PACES_KM_ULTRA, PACES_MI, PACES_MI_ULTRA, PACE_CUSTOM } from '../../data/constants';

export function StepPace() {
  const { state, dispatch } = useApp();
  const { onboarding } = state;
  const isUltra = onboarding.distanceGoal === 'ultra';
  const bandsMi = isUltra ? PACES_MI_ULTRA : PACES_MI;
  const bandsKm = isUltra ? PACES_KM_ULTRA : PACES_KM;
  const paceOptions = [...(onboarding.paceUnit === 'km' ? bandsKm : bandsMi), PACE_CUSTOM];

  return (
    <>
      <h2 style={{ marginBottom: 'var(--space-1)' }}>What's your current pace?</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        {isUltra
          ? "We'll use this to suggest partners who run at a similar clip — ultra pace runs slower than road pace once climbing and hiking are part of the terrain."
          : "We'll use this to suggest partners who run at a similar clip."}
      </p>

      <div className="seg" style={{ marginBottom: 'var(--space-4)', maxWidth: 220 }}>
        <SegOption
          name="paceunit"
          checked={onboarding.paceUnit === 'mi'}
          onChange={() => dispatch({ type: 'ONBOARDING_SELECT_PACE_UNIT', unit: 'mi' })}
          label="Miles"
        />
        <SegOption
          name="paceunit"
          checked={onboarding.paceUnit === 'km'}
          onChange={() => dispatch({ type: 'ONBOARDING_SELECT_PACE_UNIT', unit: 'km' })}
          label="Kilometers"
        />
      </div>

      <div className="stack-3" style={{ marginBottom: 'var(--space-4)' }}>
        {paceOptions.map((opt) => (
          <RadioOption
            key={opt.id}
            name="pace"
            checked={onboarding.pace === opt.id}
            onChange={() => dispatch({ type: 'ONBOARDING_SELECT_PACE', id: opt.id as any })}
            label={opt.label}
          />
        ))}
      </div>

      {onboarding.pace === 'custom' && (
        <Field label={`Your pace (${onboarding.paceUnit === 'km' ? 'min / km' : 'min / mile'})`} style={{ marginBottom: 'var(--space-4)' }}>
          <Input
            type="text"
            placeholder={onboarding.paceUnit === 'km' ? 'e.g. 5:30' : 'e.g. 8:45'}
            value={onboarding.customPace}
            onChange={(e) => dispatch({ type: 'ONBOARDING_SET_CUSTOM_PACE', value: e.target.value })}
          />
        </Field>
      )}
    </>
  );
}
