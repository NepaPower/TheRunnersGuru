import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Field, Input, SegOption, TextArea } from '../components/ui/Form';
import { useApp } from '../state/AppContext';
import { updateCrewPlan } from '../lib/api';
import { parseGpxFile } from '../lib/gpx';
import { formatEtaClock, formatElapsedLabel, predictedArrivalDate, predictedElapsedMinutes } from '../lib/crewPlan';
import {
  fetchClimateAverage,
  fetchShortRangeForecast,
  forecastAvailableFromLabel,
  isWithinForecastHorizon,
  type ClimateAverage,
  type ShortRangeForecast,
} from '../lib/weather';
import type { CrewNoteEntry, GpxWaypoint } from '../types';
import './crewplan.css';

const emptyNote: CrewNoteEntry = { nutrition: '', hydration: '', gear: '', crewAccess: '', cutoff: '' };

interface StationWeather {
  climate: ClimateAverage | null;
  climateLoading: boolean;
  forecast: ShortRangeForecast | null;
  forecastLoading: boolean;
  forecastEligible: boolean;
  monthDayLabel: string;
}

/** Best-effort extraction of a cutoff mention from a waypoint's raw GPX
 * text (some race organizers put it right in <desc> or <cmt>, as in the
 * BigFoot 200 file this was built against). This is a plain substring
 * match, not real parsing — it's a starting point to prefill the editable
 * Cutoff field, not something to trust blindly. Only used when the person
 * hasn't already typed a cutoff in themselves. */
function detectCutoffText(wp: GpxWaypoint): string {
  const source = [wp.description, wp.comment].filter(Boolean).join(' ');
  const match = source.match(/cut[\s-]?off[:\s]*([^.;]+)/i);
  return match ? match[1].trim() : '';
}

export function CrewPlan() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const plan = state.trainingPlan;

  const [raceDate, setRaceDate] = useState(plan?.raceDate ?? '');
  const [raceStartTime, setRaceStartTime] = useState(plan?.raceStartTime ?? '');
  const [goalHours, setGoalHours] = useState(plan?.goalFinishMinutes != null ? String(Math.floor(plan.goalFinishMinutes / 60)) : '');
  const [goalMinutes, setGoalMinutes] = useState(plan?.goalFinishMinutes != null ? String(plan.goalFinishMinutes % 60) : '');
  const [notes, setNotes] = useState<Record<string, CrewNoteEntry>>(() => {
    const base = plan?.crewNotes ?? {};
    const withDefaults: Record<string, CrewNoteEntry> = { ...base };
    (plan?.gpxRoute?.waypoints ?? []).forEach((wp, i) => {
      const key = String(i);
      if (!withDefaults[key]?.cutoff) {
        const detected = detectCutoffText(wp);
        if (detected) withDefaults[key] = { ...(withDefaults[key] ?? emptyNote), cutoff: detected };
      }
    });
    return withDefaults;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [weather, setWeather] = useState<Record<string, StationWeather>>({});

  const waypoints = plan?.gpxRoute?.waypoints ?? [];
  const totalMiles = plan?.gpxRoute?.distanceMiles ?? 0;
  const goalFinishMinutes = goalHours || goalMinutes ? (Number(goalHours) || 0) * 60 + (Number(goalMinutes) || 0) : null;

  // Fetches weather for every station once there's enough to compute a
  // predicted arrival date/time for it (a start time and goal finish time).
  // Historical climate average is always fetched; the real short-range
  // forecast only for stations whose predicted arrival falls within
  // Open-Meteo's ~16-day forecast horizon from today — see lib/weather.ts
  // for why anything further out can't have a real forecast at all.
  useEffect(() => {
    if (!plan || goalFinishMinutes == null || !raceStartTime) return;
    let cancelled = false;

    waypoints.forEach((wp, i) => {
      if (wp.lat == null || wp.lon == null) return;
      const key = String(i);
      const elapsed = predictedElapsedMinutes(wp.mile, totalMiles, goalFinishMinutes);
      const arrival = predictedArrivalDate(raceDate, raceStartTime, elapsed);
      if (!arrival) return;
      const y = arrival.getFullYear();
      const mo = arrival.getMonth() + 1;
      const d = arrival.getDate();
      const h = arrival.getHours();
      const monthDayLabel = arrival.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const forecastEligible = isWithinForecastHorizon(y, mo, d);

      setWeather((prev) => ({
        ...prev,
        [key]: {
          climate: prev[key]?.climate ?? null,
          forecast: prev[key]?.forecast ?? null,
          climateLoading: true,
          forecastLoading: forecastEligible,
          forecastEligible,
          monthDayLabel,
        },
      }));

      fetchClimateAverage(wp.lat, wp.lon, mo, d, y).then((climate) => {
        if (cancelled) return;
        setWeather((prev) => ({ ...prev, [key]: { ...prev[key], climate, climateLoading: false } }));
      });

      if (forecastEligible) {
        fetchShortRangeForecast(wp.lat, wp.lon, y, mo, d, h).then((forecast) => {
          if (cancelled) return;
          setWeather((prev) => ({ ...prev, [key]: { ...prev[key], forecast, forecastLoading: false } }));
        });
      }
    });

    return () => {
      cancelled = true;
    };
    // Re-runs when the inputs that change the predicted arrival date/time
    // change — waypoints/totalMiles are derived from plan.gpxRoute, which
    // is included via `plan` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, raceDate, raceStartTime, goalFinishMinutes]);

  if (!plan) {
    return (
      <>
        <Button variant="ghost" onClick={() => navigate('/home')} style={{ marginBottom: 'var(--space-4)' }}>
          ← Back to summary
        </Button>
        <p className="text-muted">No training plan yet — finish onboarding to generate one.</p>
      </>
    );
  }

  function updateNoteField(key: string, field: 'nutrition' | 'hydration' | 'gear' | 'cutoff', value: string) {
    setNotes((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyNote), [field]: value } }));
    setSaved(false);
  }

  function setCrewAccess(key: string, value: 'yes' | 'no') {
    setNotes((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyNote), crewAccess: value } }));
    setSaved(false);
  }

  async function handleSave() {
    if (!state.userId || !plan) return;
    setSaving(true);
    try {
      const raceDateToSave = raceDate || plan.raceDate;
      await updateCrewPlan(state.userId, { raceDate: raceDateToSave, raceStartTime: raceStartTime || null, goalFinishMinutes, crewNotes: notes });
      dispatch({
        type: 'TRAINING_PLAN_UPDATED',
        patch: { raceDate: raceDateToSave, raceStartTime: raceStartTime || null, goalFinishMinutes, crewNotes: notes },
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleGpxReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !state.userId) return;
    setGpxError(null);
    setGpxLoading(true);
    try {
      const route = await parseGpxFile(file);
      // The aid station list is very likely different from whatever came
      // with the old GPX, so notes keyed to the old waypoint indices would
      // silently point at the wrong stations — clear them rather than risk
      // that, same as the warning shown next to the upload button.
      await updateCrewPlan(state.userId, { gpxRoute: route, crewNotes: {} });
      dispatch({ type: 'TRAINING_PLAN_UPDATED', patch: { gpxRoute: route, crewNotes: {} } });
      setNotes({});
      setSaved(false);
    } catch (err) {
      setGpxError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setGpxLoading(false);
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={() => navigate('/home')} style={{ marginBottom: 'var(--space-4)' }}>
        ← Back to summary
      </Button>

      <div className="rg-cp-header-card">
        <div className="rg-cp-header-top">
          <div className="rg-cp-race-name">Crew Plan for {plan.raceName}</div>
          {plan.gpxRoute && (
            <div className="text-muted">
              {plan.gpxRoute.distanceMiles} mi course · {plan.gpxRoute.elevationGainFt.toLocaleString()} ft gain ·{' '}
              {plan.gpxRoute.elevationLossFt.toLocaleString()} ft loss
            </div>
          )}
        </div>

        <div className="rg-cp-gpx-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Course file</div>
            <div className="text-muted" style={{ fontSize: 13 }}>
              {plan.gpxRoute
                ? `${plan.gpxRoute.fileName} — ${waypoints.length} aid station${waypoints.length === 1 ? '' : 's'} found`
                : 'No GPX uploaded yet.'}
            </div>
          </div>
          <div style={{ flex: 'none' }}>
            <Button variant="secondary" disabled={gpxLoading} onClick={() => fileInputRef.current?.click()}>
              {gpxLoading ? 'Reading file…' : plan.gpxRoute ? 'Replace GPX' : 'Upload GPX'}
            </Button>
            <input ref={fileInputRef} type="file" accept=".gpx" onChange={handleGpxReplace} style={{ display: 'none' }} />
          </div>
        </div>
        {plan.gpxRoute && (
          <p className="text-muted" style={{ fontSize: 12, padding: '0 var(--space-6) var(--space-4)', margin: 0 }}>
            Replacing the course file clears any aid station notes already added below, since the new file's stations
            may not match up with the old ones.
          </p>
        )}
        {gpxError && (
          <div className="rg-auth-error" style={{ margin: '0 var(--space-6) var(--space-4)' }}>
            {gpxError}
          </div>
        )}

        <div className="rg-cp-setup-grid">
          <Field label="Race start date">
            <Input
              type="date"
              value={raceDate}
              onChange={(e) => {
                setRaceDate(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <Field label="Race start time">
            <Input
              type="time"
              value={raceStartTime}
              onChange={(e) => {
                setRaceStartTime(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <Field label="Goal finish — hours">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 38"
              value={goalHours}
              onChange={(e) => {
                setGoalHours(e.target.value.replace(/[^\d]/g, ''));
                setSaved(false);
              }}
            />
          </Field>
          <Field label="Goal finish — minutes">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={goalMinutes}
              onChange={(e) => {
                setGoalMinutes(e.target.value.replace(/[^\d]/g, ''));
                setSaved(false);
              }}
            />
          </Field>
        </div>
      </div>

      {waypoints.length === 0 ? (
        <div className="rg-cp-empty-card">
          <p className="text-muted" style={{ marginBottom: 0 }}>
            {plan.gpxRoute
              ? "This course file doesn't have any named aid stations. Some race organizers publish those as a separate GPX from the main course file — use \"Replace GPX\" above if you find one."
              : 'Upload a course GPX above to build out aid station pacing and crew notes.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-muted" style={{ marginBottom: 'var(--space-4)', fontSize: 13 }}>
            {goalFinishMinutes
              ? 'Predicted arrival times assume even effort across the whole course — treat these as a starting estimate, not a guarantee, especially on technical terrain.'
              : 'Enter a goal finish time above to see predicted arrival times at each aid station.'}
          </p>

          <div className="rg-cp-stations">
            {waypoints.map((wp, i) => {
              const key = String(i);
              const note = notes[key] ?? emptyNote;
              const elapsed = goalFinishMinutes != null ? predictedElapsedMinutes(wp.mile, totalMiles, goalFinishMinutes) : null;
              const arrival = elapsed != null ? predictedArrivalDate(raceDate, raceStartTime, elapsed) : null;
              const eta = elapsed != null && raceStartTime ? formatEtaClock(raceDate, raceStartTime, elapsed) : null;
              return (
                <div key={key} className="rg-cp-station-card">
                  <div className="rg-cp-station-head">
                    <div>
                      <div className="rg-cp-station-name">{wp.name}</div>
                      <div className="rg-cp-station-meta">
                        Mile {wp.mile}
                        {wp.elevationFt != null ? ` · ${wp.elevationFt.toLocaleString()} ft` : ''}
                      </div>
                      {(wp.description || wp.comment || wp.symbol || wp.waypointType || (wp.lat != null && wp.lon != null)) && (
                        <div className="rg-cp-station-meta" style={{ marginTop: 4 }}>
                          {wp.description && <div>{wp.description}</div>}
                          {wp.comment && <div>Note: {wp.comment}</div>}
                          {(wp.symbol || wp.waypointType) && (
                            <div>
                              {[wp.symbol, wp.waypointType].filter(Boolean).join(' · ')}
                            </div>
                          )}
                          {wp.lat != null && wp.lon != null && (
                            <div>
                              {wp.lat.toFixed(5)}, {wp.lon.toFixed(5)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {elapsed != null && (
                      <div className="rg-cp-station-eta">
                        {eta ? (
                          <>
                            <div className="rg-cp-eta-value">You'll reach here on {eta}</div>
                            <div className="rg-cp-station-meta" style={{ fontSize: 12 }}>
                              +{formatElapsedLabel(elapsed)} from start
                            </div>
                          </>
                        ) : (
                          <div className="rg-cp-station-meta" style={{ fontSize: 13 }}>
                            Set a race start time above to see your predicted arrival time
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rg-cp-station-fields">
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Crew access</div>
                      <div className="seg" style={{ maxWidth: 160 }}>
                        <SegOption name={`crew-${key}`} checked={note.crewAccess === 'yes'} onChange={() => setCrewAccess(key, 'yes')} label="Yes" />
                        <SegOption name={`crew-${key}`} checked={note.crewAccess === 'no'} onChange={() => setCrewAccess(key, 'no')} label="No" />
                      </div>
                    </div>
                    <Field label="Cutoff (Day, Time)" style={{ gridColumn: 'span 2' }}>
                      <Input
                        type="text"
                        placeholder="e.g. Day 1, 10:00 PM"
                        value={note.cutoff}
                        onChange={(e) => updateNoteField(key, 'cutoff', e.target.value)}
                      />
                    </Field>
                  </div>

                  {(wp.lat != null && wp.lon != null && (weather[key]?.climate || weather[key]?.climateLoading)) && (
                    <div className="rg-cp-weather-row">
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                          Historical average — {weather[key]?.monthDayLabel}
                        </div>
                        {weather[key]?.climate ? (
                          <div className="rg-cp-station-meta">
                            High {weather[key]!.climate!.avgHighF}°F / Low {weather[key]!.climate!.avgLowF}°F
                            <span style={{ fontSize: 12 }}> (avg of last {weather[key]!.climate!.yearsUsed} years)</span>
                          </div>
                        ) : (
                          <div className="rg-cp-station-meta">Loading…</div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Short-range forecast</div>
                        {weather[key]?.forecastEligible ? (
                          weather[key]?.forecast ? (
                            <div className="rg-cp-station-meta">{weather[key]!.forecast!.tempF}°F</div>
                          ) : weather[key]?.forecastLoading ? (
                            <div className="rg-cp-station-meta">Loading…</div>
                          ) : (
                            <div className="rg-cp-station-meta">Not available</div>
                          )
                        ) : (
                          <div className="rg-cp-station-meta">
                            {arrival ? `Available starting ${forecastAvailableFromLabel(arrival.getFullYear(), arrival.getMonth() + 1, arrival.getDate())}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rg-cp-station-notes">
                    <Field label="Nutrition">
                      <TextArea rows={2} value={note.nutrition} onChange={(e) => updateNoteField(key, 'nutrition', e.target.value)} />
                    </Field>
                    <Field label="Hydration">
                      <TextArea rows={2} value={note.hydration} onChange={(e) => updateNoteField(key, 'hydration', e.target.value)} />
                    </Field>
                    <Field label="Gear change">
                      <TextArea rows={2} value={note.gear} onChange={(e) => updateNoteField(key, 'gear', e.target.value)} />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rg-cp-save-footer">
            <Button variant="primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save crew plan'}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
