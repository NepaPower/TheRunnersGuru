import { useRef, useState } from 'react';
import { Field, Input, RadioOption } from '../../components/ui/Form';
import { Button } from '../../components/ui/Button';
import { useApp } from '../../state/AppContext';
import { DISTANCE_LABELS, MAX_ULTRA_MILES, STANDARD_DISTANCES, ULTRA_DISTANCES } from '../../data/constants';
import { ultraDistanceLabel, ultraDistanceMiles } from '../../lib/ultraDistance';
import { parseGpxFile } from '../../lib/gpx';

export function StepDistance() {
  const { state, dispatch } = useApp();
  const { onboarding } = state;
  const isUltra = onboarding.raceCategory === 'ultra';
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDistance = isUltra
    ? !!onboarding.ultraDistanceId && (onboarding.ultraDistanceId !== 'custom' || ultraDistanceMiles(onboarding) !== null)
    : !!onboarding.distanceGoal;
  const showPicker = !hasDistance || onboarding.distanceEditing;

  const distanceSummaryLabel = isUltra
    ? ultraDistanceLabel(onboarding)
    : DISTANCE_LABELS[onboarding.distanceGoal as keyof typeof DISTANCE_LABELS];

  async function handleGpxSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after removing it
    if (!file) return;
    setGpxError(null);
    setGpxLoading(true);
    try {
      const route = await parseGpxFile(file);
      dispatch({ type: 'ONBOARDING_SET_GPX_ROUTE', route });
    } catch (err) {
      setGpxError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setGpxLoading(false);
    }
  }

  return (
    <>
      <h2 style={{ marginBottom: 'var(--space-1)' }}>{isUltra ? 'What ultra distance are you training for?' : 'What distance are you training for?'}</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        We'll shape your plan around this.
      </p>

      {hasDistance && !onboarding.distanceEditing && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--color-accent-300)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <span style={{ fontWeight: 600 }}>{distanceSummaryLabel}</span>
          <Button variant="ghost" onClick={() => dispatch({ type: 'ONBOARDING_EDIT_DISTANCE' })}>
            Change
          </Button>
        </div>
      )}

      {showPicker && !isUltra && (
        <div className="stack-3" style={{ marginBottom: 'var(--space-8)' }}>
          {STANDARD_DISTANCES.map((opt) => (
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

      {showPicker && isUltra && (
        <>
          <div className="stack-3" style={{ marginBottom: 'var(--space-4)' }}>
            {ULTRA_DISTANCES.map((opt) => (
              <RadioOption
                key={opt.id}
                name="ultradistance"
                checked={onboarding.ultraDistanceId === opt.id}
                onChange={() => dispatch({ type: 'ONBOARDING_SELECT_ULTRA_DISTANCE', id: opt.id })}
                label={opt.label}
              />
            ))}
          </div>

          {onboarding.ultraDistanceId === 'custom' && (
            <Field label={`Your distance in miles (up to ${MAX_ULTRA_MILES})`} style={{ marginBottom: 'var(--space-4)' }}>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 220"
                value={onboarding.ultraCustomMiles}
                onChange={(e) => dispatch({ type: 'ONBOARDING_SET_ULTRA_CUSTOM_MILES', value: e.target.value })}
              />
            </Field>
          )}

          <div style={{ marginBottom: 'var(--space-4)' }} />
        </>
      )}

      {hasDistance && (
        <>
          <h6 style={{ marginBottom: 'var(--space-2)' }}>What race are you planning to run?</h6>
          <p className="text-muted" style={{ marginBottom: 'var(--space-4)', fontSize: 13 }}>
            Enter the name of your race.
          </p>

          <Field label="Race name" style={{ marginBottom: isUltra ? 'var(--space-6)' : 'var(--space-4)' }}>
            <Input
              type="text"
              placeholder="e.g. Big Sur Marathon"
              value={onboarding.raceName}
              onChange={(e) => dispatch({ type: 'ONBOARDING_SET_RACE_NAME', value: e.target.value })}
            />
          </Field>

          {isUltra && (
            <>
              <h6 style={{ marginBottom: 'var(--space-2)' }}>Race GPX (optional)</h6>
              <p className="text-muted" style={{ marginBottom: 'var(--space-4)', fontSize: 13 }}>
                Have the official course file? Upload it and we'll pull distance, elevation, and aid stations for
                crew and pace planning later. Skip this if you don't have it yet — you can add it anytime.
              </p>

              {gpxError && <div className="rg-auth-error">{gpxError}</div>}

              {onboarding.gpxRoute ? (
                <div style={{ border: '1px solid var(--color-accent-300)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 600, fontSize: 14, wordBreak: 'break-word', minWidth: 0 }}>{onboarding.gpxRoute.fileName}</span>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        dispatch({ type: 'ONBOARDING_SET_GPX_ROUTE', route: null });
                        setGpxError(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                  <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                    {onboarding.gpxRoute.distanceMiles} mi course · {onboarding.gpxRoute.elevationGainFt.toLocaleString()} ft gain ·{' '}
                    {onboarding.gpxRoute.elevationLossFt.toLocaleString()} ft loss
                    {onboarding.gpxRoute.waypoints.length > 0
                      ? ` · ${onboarding.gpxRoute.waypoints.length} aid station${onboarding.gpxRoute.waypoints.length === 1 ? '' : 's'} found`
                      : ' · no named aid stations in this file'}
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <Button variant="secondary" disabled={gpxLoading} onClick={() => fileInputRef.current?.click()}>
                    {gpxLoading ? 'Reading file…' : 'Upload GPX file'}
                  </Button>
                  <input ref={fileInputRef} type="file" accept=".gpx" onChange={handleGpxSelect} style={{ display: 'none' }} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
