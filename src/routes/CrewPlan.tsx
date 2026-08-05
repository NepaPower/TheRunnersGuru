import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Field, Input, SegOption, TextArea } from '../components/ui/Form';
import { useApp } from '../state/AppContext';
import {
  updateCrewPlan,
  updateCrewPlanById,
  fetchTrainingPlanById,
  inviteCrewMember,
  fetchCrewAccessList,
  removeCrewAccess,
} from '../lib/api';
import { parseGpxFile } from '../lib/gpx';
import {
  formatEtaClock,
  formatElapsedLabel,
  formatPaceMinPerMile,
  predictedArrivalDate,
  computeStationTimings,
  parseCutoffOrderMinutes,
} from '../lib/crewPlan';
import {
  fetchClimateAverage,
  fetchShortRangeForecast,
  forecastAvailableFromLabel,
  isWithinForecastHorizon,
  type ClimateAverage,
  type ShortRangeForecast,
} from '../lib/weather';
import type { CrewAccessEntry, CrewNoteEntry, GpxWaypoint, TrainingPlan } from '../types';
import './crewplan.css';

const emptyNote: CrewNoteEntry = {
  nutrition: '',
  hydration: '',
  gear: '',
  crewAccess: '',
  cutoff: '',
  restHours: '',
  restMinutes: '',
  avgPaceMin: '',
  avgPaceSec: '',
};

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

/** Builds the notes map for a set of waypoints, auto-filling the Cutoff
 * field from the GPX's own text wherever one is found and the person
 * hasn't already typed something in. Used both for the initial page load
 * and after replacing the GPX — a station's cutoff should be picked up
 * automatically either way, not just on first load. */
function buildNotesWithDetectedCutoffs(waypoints: GpxWaypoint[], existingNotes: Record<string, CrewNoteEntry>): Record<string, CrewNoteEntry> {
  const withDefaults: Record<string, CrewNoteEntry> = { ...existingNotes };
  waypoints.forEach((wp, i) => {
    const key = String(i);
    if (!withDefaults[key]?.cutoff) {
      const detected = detectCutoffText(wp);
      if (detected) withDefaults[key] = { ...(withDefaults[key] ?? emptyNote), cutoff: detected };
    }
  });
  return withDefaults;
}

export function CrewPlan() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { planId: sharedPlanId } = useParams<{ planId: string }>();
  const isShared = !!sharedPlanId;

  // Shared mode: this plan isn't the signed-in user's own — fetch it by id
  // (RLS only lets this succeed for an accepted crew member) into local
  // state, never into the global state.trainingPlan slot, which is
  // reserved for the signed-in user's own plan.
  const [sharedPlan, setSharedPlan] = useState<TrainingPlan | null>(null);
  const [sharedPlanLoading, setSharedPlanLoading] = useState(isShared);
  const [sharedPlanError, setSharedPlanError] = useState<string | null>(null);

  useEffect(() => {
    if (!isShared || !sharedPlanId) return;
    let cancelled = false;
    setSharedPlanLoading(true);
    setSharedPlanError(null);
    fetchTrainingPlanById(sharedPlanId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setSharedPlanError("This plan isn't available — you may not have access to it, or it may have been removed.");
          return;
        }
        setSharedPlan(result.plan);
      })
      .catch((err) => {
        if (!cancelled) setSharedPlanError(err instanceof Error ? err.message : 'Could not load this plan.');
      })
      .finally(() => {
        if (!cancelled) setSharedPlanLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isShared, sharedPlanId]);

  const plan = isShared ? sharedPlan : state.trainingPlan;

  // Invite management — owner mode only. Fetched once the owner's plan id
  // is known.
  const [crewAccessList, setCrewAccessList] = useState<CrewAccessEntry[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (isShared || !plan?.id) return;
    let cancelled = false;
    fetchCrewAccessList(plan.id).then((list) => {
      if (!cancelled) setCrewAccessList(list);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShared, plan?.id]);

  const [raceDate, setRaceDate] = useState(plan?.raceDate ?? '');
  const [raceStartTime, setRaceStartTime] = useState(plan?.raceStartTime ?? '');
  const [goalHours, setGoalHours] = useState(plan?.goalFinishMinutes != null ? String(Math.floor(plan.goalFinishMinutes / 60)) : '');
  const [goalMinutes, setGoalMinutes] = useState(plan?.goalFinishMinutes != null ? String(plan.goalFinishMinutes % 60) : '');
  const [notes, setNotes] = useState<Record<string, CrewNoteEntry>>(() =>
    buildNotesWithDetectedCutoffs(plan?.gpxRoute?.waypoints ?? [], plan?.crewNotes ?? {}),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [weather, setWeather] = useState<Record<string, StationWeather>>({});

  const waypoints = plan?.gpxRoute?.waypoints ?? [];
  const totalMiles = plan?.gpxRoute?.distanceMiles ?? 0;
  const goalFinishMinutes = goalHours || goalMinutes ? (Number(goalHours) || 0) * 60 + (Number(goalMinutes) || 0) : null;
  // The pace implied by the goal finish time, before any per-station
  // override — this is what the "Average mins per mile" ends up being if
  // nobody enters an override anywhere, and it's what each pace field's
  // placeholder shows.
  const initialPaceMinPerMile = goalFinishMinutes != null && totalMiles > 0 ? goalFinishMinutes / totalMiles : null;
  // Each station's rest/sleep time delays every station after it, and any
  // avg-pace override entered at a station applies to every segment AFTER
  // it (until overridden again) — see lib/crewPlan.ts
  // computeStationTimings. Recomputed from current `notes` state on every
  // render; cheap even for a long aid-station list.
  const timings =
    goalFinishMinutes != null
      ? computeStationTimings(
          waypoints.map((wp) => wp.mile),
          totalMiles,
          goalFinishMinutes,
          waypoints.map((_, i) => (Number(notes[String(i)]?.restHours) || 0) * 60 + (Number(notes[String(i)]?.restMinutes) || 0)),
          waypoints.map((_, i) => {
            const note = notes[String(i)];
            if (!note?.avgPaceMin && !note?.avgPaceSec) return null;
            return (Number(note.avgPaceMin) || 0) + (Number(note.avgPaceSec) || 0) / 60;
          }),
        )
      : null;
  const elapsedByIndex: (number | null)[] = timings ? timings.map((t) => t.elapsedMinutes) : waypoints.map(() => null);
  // Cutoff times only ever move forward through a race — if a station's
  // cutoff (as typed/detected, in geographic mile order) is earlier than
  // an earlier station's, that's independent evidence something's out of
  // sequence, since cutoff time and course position are set by the race
  // organizer from two completely different sources of truth.
  const raceStartWeekdayIndex = raceDate ? new Date(raceDate + 'T00:00:00').getDay() : null;
  const cutoffOutOfOrder: boolean[] = (() => {
    if (raceStartWeekdayIndex == null) return waypoints.map(() => false);
    let maxSoFar = -Infinity;
    return waypoints.map((_, i) => {
      const text = notes[String(i)]?.cutoff || '';
      const v = text ? parseCutoffOrderMinutes(text, raceStartWeekdayIndex) : null;
      if (v == null) return false;
      const outOfOrder = v < maxSoFar;
      maxSoFar = Math.max(maxSoFar, v);
      return outOfOrder;
    });
  })();
  // Weather should re-fetch when rest times or pace overrides shift
  // arrival times, but NOT on every keystroke in the Nutrition/Hydration/
  // Gear textareas — this isolates just the fields that actually affect
  // the math.
  const restSignature = waypoints
    .map(
      (_, i) =>
        `${notes[String(i)]?.restHours || ''}:${notes[String(i)]?.restMinutes || ''}:${notes[String(i)]?.avgPaceMin || ''}:${notes[String(i)]?.avgPaceSec || ''}`,
    )
    .join(',');

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
      const elapsed = elapsedByIndex[i];
      if (elapsed == null) return;
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
  }, [plan, raceDate, raceStartTime, goalFinishMinutes, restSignature]);

  if (isShared && sharedPlanLoading) {
    return (
      <>
        <Button variant="ghost" onClick={() => navigate('/shared-plans')} style={{ marginBottom: 'var(--space-4)' }}>
          ← Back to shared plans
        </Button>
        <p className="rg-cp-muted">Loading…</p>
      </>
    );
  }

  if (isShared && sharedPlanError) {
    return (
      <>
        <Button variant="ghost" onClick={() => navigate('/shared-plans')} style={{ marginBottom: 'var(--space-4)' }}>
          ← Back to shared plans
        </Button>
        <div className="rg-auth-error">{sharedPlanError}</div>
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <Button variant="ghost" onClick={() => navigate(isShared ? '/shared-plans' : '/home')} style={{ marginBottom: 'var(--space-4)' }}>
          ← Back
        </Button>
        <p className="rg-cp-muted">No training plan yet — finish onboarding to generate one.</p>
      </>
    );
  }

  function updateNoteField(
    key: string,
    field: 'nutrition' | 'hydration' | 'gear' | 'cutoff' | 'restHours' | 'restMinutes' | 'avgPaceMin' | 'avgPaceSec',
    value: string,
  ) {
    setNotes((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyNote), [field]: value } }));
    setSaved(false);
  }

  function setCrewAccess(key: string, value: 'yes' | 'no' | 'sleep') {
    setNotes((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyNote), crewAccess: value } }));
    setSaved(false);
  }

  async function handleSave() {
    if (!state.userId || !plan) return;
    setSaving(true);
    try {
      const raceDateToSave = raceDate || plan.raceDate;
      const updates = { raceDate: raceDateToSave, raceStartTime: raceStartTime || null, goalFinishMinutes, crewNotes: notes };
      if (isShared) {
        if (!plan.id) return;
        await updateCrewPlanById(plan.id, updates);
        setSharedPlan((prev) => (prev ? { ...prev, ...updates } : prev));
      } else {
        await updateCrewPlan(state.userId, updates);
        dispatch({ type: 'TRAINING_PLAN_UPDATED', patch: updates });
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleGpxReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !state.userId || !plan) return;
    setGpxError(null);
    setGpxLoading(true);
    try {
      const route = await parseGpxFile(file);
      // The aid station list is very likely different from whatever came
      // with the old GPX, so notes keyed to the old waypoint indices would
      // silently point at the wrong stations — clear them rather than risk
      // that, same as the warning shown next to the upload button. Still
      // auto-fill Cutoff from the new file's own text where present, same
      // as the initial page load does — a replaced file's cutoffs
      // shouldn't have to be retyped by hand.
      const freshNotes = buildNotesWithDetectedCutoffs(route.waypoints, {});
      if (isShared) {
        if (!plan.id) return;
        await updateCrewPlanById(plan.id, { gpxRoute: route, crewNotes: freshNotes });
        setSharedPlan((prev) => (prev ? { ...prev, gpxRoute: route, crewNotes: freshNotes } : prev));
      } else {
        await updateCrewPlan(state.userId, { gpxRoute: route, crewNotes: freshNotes });
        dispatch({ type: 'TRAINING_PLAN_UPDATED', patch: { gpxRoute: route, crewNotes: freshNotes } });
      }
      setNotes(freshNotes);
      setSaved(false);
    } catch (err) {
      setGpxError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setGpxLoading(false);
    }
  }

  async function handleInvite() {
    if (!state.userId || !plan?.id || !inviteEmail.trim()) return;
    setInviteSaving(true);
    setInviteError(null);
    try {
      await inviteCrewMember(state.userId, plan.id, inviteEmail.trim());
      setInviteEmail('');
      setCrewAccessList(await fetchCrewAccessList(plan.id));
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not send that invite.');
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleRemoveAccess(accessId: string) {
    if (!plan?.id) return;
    await removeCrewAccess(accessId);
    setCrewAccessList(await fetchCrewAccessList(plan.id));
  }

  return (
    <>
      <Button variant="ghost" onClick={() => navigate(isShared ? '/shared-plans' : '/home')} style={{ marginBottom: 'var(--space-4)' }}>
        ← Back to {isShared ? 'shared plans' : 'summary'}
      </Button>

      <div className="rg-cp-header-card">
        <div className="rg-cp-header-top">
          <div className="rg-cp-race-name">Crew Plan for {plan.raceName}</div>
          {plan.gpxRoute && (
            <div className="rg-cp-muted">
              {plan.gpxRoute.distanceMiles} mi course · {plan.gpxRoute.elevationGainFt.toLocaleString()} ft gain ·{' '}
              {plan.gpxRoute.elevationLossFt.toLocaleString()} ft loss
            </div>
          )}
        </div>

        <div className="rg-cp-gpx-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Course file</div>
            <div className="rg-cp-muted" style={{ fontSize: 13 }}>
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
          <p className="rg-cp-muted" style={{ fontSize: 12, padding: '0 var(--space-6) var(--space-4)', margin: 0 }}>
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

      {!isShared && (
        <div className="rg-cp-header-card">
          <div className="rg-cp-header-top">
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Crew members</div>
            <p className="rg-cp-muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Invite people to view and edit this Crew Plan. They'll get access automatically the next time they sign
              in with this email — there's no email sent by the app, so let them know directly.
            </p>
          </div>
          <div className="rg-cp-gpx-row" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Input
                type="email"
                placeholder="crew@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <Button variant="secondary" disabled={inviteSaving || !inviteEmail.trim() || !plan.id} onClick={handleInvite}>
              {inviteSaving ? 'Sending…' : 'Send invite'}
            </Button>
          </div>
          {inviteError && (
            <div className="rg-auth-error" style={{ margin: '0 var(--space-6) var(--space-4)' }}>
              {inviteError}
            </div>
          )}
          {crewAccessList.length > 0 && (
            <div style={{ padding: '0 var(--space-6) var(--space-6)' }}>
              {crewAccessList.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: 'var(--space-2) 0',
                    borderTop: '1px solid var(--color-divider)',
                  }}
                >
                  <div style={{ fontSize: 14, wordBreak: 'break-word', minWidth: 0 }}>
                    {c.invitedEmail}{' '}
                    <span className="rg-cp-muted" style={{ fontSize: 12 }}>
                      ({c.status === 'accepted' ? 'active' : 'invited, not yet signed in'})
                    </span>
                  </div>
                  <Button variant="ghost" onClick={() => handleRemoveAccess(c.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {waypoints.length === 0 ? (
        <div className="rg-cp-empty-card">
          <p className="rg-cp-muted" style={{ marginBottom: 0 }}>
            {plan.gpxRoute
              ? "This course file doesn't have any named aid stations. Some race organizers publish those as a separate GPX from the main course file — use \"Replace GPX\" above if you find one."
              : 'Upload a course GPX above to build out aid station pacing and crew notes.'}
          </p>
        </div>
      ) : (
        <>
          <p className="rg-cp-muted" style={{ marginBottom: 'var(--space-4)', fontSize: 13 }}>
            {goalFinishMinutes
              ? `Predicted arrival times start from an initial average pace of ${initialPaceMinPerMile != null ? formatPaceMinPerMile(initialPaceMinPerMile) : '—'} (your goal finish time ÷ course distance). Enter an updated avg pace at any station below to reflect how the race is actually going — it carries forward from there until you update it again.`
              : 'Enter a goal finish time above to see predicted arrival times at each aid station.'}
          </p>

          <div className="rg-cp-stations">
            {waypoints.map((wp, i) => {
              const key = String(i);
              const note = notes[key] ?? emptyNote;
              const elapsed = elapsedByIndex[i];
              const arrival = elapsed != null ? predictedArrivalDate(raceDate, raceStartTime, elapsed) : null;
              const eta = elapsed != null && raceStartTime ? formatEtaClock(raceDate, raceStartTime, elapsed) : null;
              const prevMile = i === 0 ? 0 : waypoints[i - 1].mile;
              const segmentMiles = Math.max(0, Math.round((wp.mile - prevMile) * 10) / 10);
              return (
                <div key={key} className="rg-cp-station-card">
                  <div className="rg-cp-station-head">
                    <div>
                      <div className="rg-cp-station-name">{wp.name}</div>
                      <div className="rg-cp-station-meta">
                        Mile {wp.mile}
                        {wp.elevationFt != null ? ` | ${wp.elevationFt.toLocaleString()} ft` : ''}
                        {` | ${segmentMiles} mi from ${i === 0 ? 'start' : 'previous stop'}`}
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
                              +{formatElapsedLabel(elapsed)} from start · {formatPaceMinPerMile(timings![i].paceUsedMinPerMile)} pace
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
                      <div className="seg" style={{ maxWidth: 220 }}>
                        <SegOption name={`crew-${key}`} checked={note.crewAccess === 'yes'} onChange={() => setCrewAccess(key, 'yes')} label="Yes" />
                        <SegOption name={`crew-${key}`} checked={note.crewAccess === 'no'} onChange={() => setCrewAccess(key, 'no')} label="No" />
                        <SegOption name={`crew-${key}`} checked={note.crewAccess === 'sleep'} onChange={() => setCrewAccess(key, 'sleep')} label="Sleep" />
                      </div>
                    </div>
                    <Field label="Cutoff (Day, Time)">
                      <Input
                        type="text"
                        placeholder="e.g. Day 1, 10:00 PM"
                        value={note.cutoff}
                        onChange={(e) => updateNoteField(key, 'cutoff', e.target.value)}
                      />
                      {cutoffOutOfOrder[i] && (
                        <div style={{ fontSize: 12, color: 'var(--color-accent-2-800, #92400e)', marginTop: 4 }}>
                          ⚠ Earlier than a prior station's cutoff — this station may be out of order
                        </div>
                      )}
                    </Field>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Rest/Sleep time</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="hrs"
                          value={note.restHours}
                          onChange={(e) => updateNoteField(key, 'restHours', e.target.value.replace(/[^\d]/g, ''))}
                        />
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="min"
                          value={note.restMinutes}
                          onChange={(e) => updateNoteField(key, 'restMinutes', e.target.value.replace(/[^\d]/g, ''))}
                        />
                      </div>
                      {(Number(note.restHours) > 0 || Number(note.restMinutes) > 0) && (
                        <div className="rg-cp-muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Adds {formatElapsedLabel((Number(note.restHours) || 0) * 60 + (Number(note.restMinutes) || 0))} to every station after this one
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Avg pace from here</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder={initialPaceMinPerMile != null ? String(Math.floor(initialPaceMinPerMile)) : 'min'}
                          value={note.avgPaceMin}
                          onChange={(e) => updateNoteField(key, 'avgPaceMin', e.target.value.replace(/[^\d]/g, ''))}
                        />
                        <span className="rg-cp-muted" style={{ fontSize: 13 }}>:</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="sec"
                          value={note.avgPaceSec}
                          onChange={(e) => updateNoteField(key, 'avgPaceSec', e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                        />
                        <span className="rg-cp-muted" style={{ fontSize: 13 }}>/mi</span>
                      </div>
                      {(note.avgPaceMin || note.avgPaceSec) && (
                        <div className="rg-cp-muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Applies to every station after this one, until updated again
                        </div>
                      )}
                    </div>
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
