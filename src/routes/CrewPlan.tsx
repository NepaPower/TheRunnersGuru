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
  promoteToChief,
  fetchMyCrewRole,
  claimCrewPlanLock,
  releaseCrewPlanLock,
  heartbeatCrewPlanLock,
  fetchCrewPlanLock,
  isCrewPlanLockActive,
  type CrewPlanLockState,
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
import { BIGFOOT_200_SEGMENTS, type CourseSegment } from '../data/bigfoot200Segments';
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
  dropBag: false,
  pacerPickup: false,
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

/** Strips just the cutoff sentence out of a waypoint's raw description or
 * comment text, leaving any other content in that field intact — the
 * cutoff already gets its own prominent display (see the red Cutoff
 * badge), so repeating the exact same sentence in the raw-text block
 * below it is pure duplication for files where the description is
 * nothing but the cutoff mention, without silently hiding genuinely
 * different info for files where it's mixed in with other notes. */
function stripCutoffMention(text: string | undefined): string | undefined {
  if (!text) return text;
  const stripped = text.replace(/cut[\s-]?off[:\s]*[^.;]+[.;]?/i, '').trim();
  return stripped || undefined;
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

  // Check-in/check-out — a soft lock so two people editing this plan at
  // once (owner + crew, or two crew members) don't silently overwrite
  // each other. See the crew-plan-lock functions in lib/api.ts for the
  // actual claim/heartbeat/release/timeout logic; this just drives it
  // from the component's lifecycle.
  const [lockState, setLockState] = useState<CrewPlanLockState | null>(null);
  const [lockChecked, setLockChecked] = useState(false);
  const myDisplayName = state.auth.name || state.auth.email || 'Someone';
  const iHoldLock = lockChecked && lockState?.userId === state.userId;
  const readOnlyMode = lockChecked && !iHoldLock && lockState != null && isCrewPlanLockActive(lockState);

  useEffect(() => {
    if (!plan?.id || !state.userId) return;
    let cancelled = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    async function tryClaim() {
      if (!plan?.id || !state.userId) return;
      try {
        const result = await claimCrewPlanLock(plan.id, state.userId, myDisplayName);
        if (cancelled) return;
        setLockState(result.heldBy);
        setLockChecked(true);
        if (result.claimed) {
          // Held — keep it fresh so it doesn't expire out from under an
          // actively-open tab.
          heartbeatTimer = setInterval(() => {
            if (plan?.id && state.userId) heartbeatCrewPlanLock(plan.id, state.userId).catch(() => {});
          }, 60_000);
        } else {
          // Someone else has it — poll for it to free up so this tab can
          // pick it up automatically rather than needing a manual retry.
          pollTimer = setInterval(async () => {
            if (!plan?.id) return;
            const current = await fetchCrewPlanLock(plan.id).catch(() => null);
            if (!current || cancelled) return;
            if (!isCrewPlanLockActive(current)) {
              // Looks free now — try to actually claim it (still not
              // atomic, see claimCrewPlanLock's own note, but fine at
              // this scale).
              clearInterval(pollTimer);
              tryClaim();
            } else {
              setLockState(current);
            }
          }, 15_000);
        }
      } catch {
        // Non-fatal — worst case, editing just isn't lock-protected this
        // session rather than blocking the page entirely.
        if (!cancelled) setLockChecked(true);
      }
    }
    tryClaim();

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (plan?.id && state.userId) releaseCrewPlanLock(plan.id, state.userId).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, state.userId]);

  // No beforeunload release handler here on purpose — a real browser tab
  // close can't reliably complete an authenticated API call in that
  // event (sendBeacon can't carry the auth header Supabase's REST API
  // needs), so anything attempted here would silently fail more often
  // than it'd help. The useEffect cleanup above already covers real SPA
  // navigation (clicking Back, etc.), and the lock's own timeout is the
  // actual safety net for a genuinely closed tab or dead phone.

  // Invite management — owner mode only. Fetched once the owner's plan id
  // is known.
  const [crewAccessList, setCrewAccessList] = useState<CrewAccessEntry[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteAsChief, setInviteAsChief] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<CourseSegment | null>(null);

  // Shared mode only — this crew member's own role, used to decide
  // whether to show the Upload/Replace GPX control at all. The real
  // restriction is enforced server-side regardless (see schema.sql's
  // enforce_gpx_route_chief_only trigger); this is just so a regular
  // crew member doesn't see a button that would fail if they clicked it.
  const [myCrewRole, setMyCrewRole] = useState<'crew' | 'chief' | null>(null);
  useEffect(() => {
    if (!isShared || !sharedPlanId || !state.userId) return;
    let cancelled = false;
    fetchMyCrewRole(sharedPlanId, state.userId).then((role) => {
      if (!cancelled) setMyCrewRole(role);
    });
    return () => {
      cancelled = true;
    };
  }, [isShared, sharedPlanId, state.userId]);

  useEffect(() => {
    if (isShared || !plan?.id) return;
    let cancelled = false;
    fetchCrewAccessList(plan.id)
      .then((list) => {
        if (!cancelled) setCrewAccessList(list);
      })
      .catch((err) => {
        if (!cancelled) setInviteError(err instanceof Error ? err.message : 'Could not load the crew list.');
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
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [weather, setWeather] = useState<Record<string, StationWeather>>({});

  // The useState calls above only use their initial value on this
  // component's very first render — in shared mode that's BEFORE the
  // async fetch above resolves, when `plan` is still null. React never
  // re-applies a useState initializer later, so without this effect,
  // every field (race date/time, goal time, all station notes) would
  // silently stay stuck at empty defaults forever once the real plan
  // loads, even though `plan` itself updates correctly. Owner mode never
  // hits this, since `plan` (= state.trainingPlan) is already populated
  // before this component even mounts.
  // Starts true so the very first render (owner: already-loaded plan;
  // shared: the resync effect above) doesn't immediately "autosave"
  // unchanged data the instant the page opens — only genuine edits after
  // that should trigger it.
  const skipNextAutosaveRef = useRef(true);

  useEffect(() => {
    if (!isShared || !sharedPlan) return;
    setRaceDate(sharedPlan.raceDate ?? '');
    setRaceStartTime(sharedPlan.raceStartTime ?? '');
    setGoalHours(sharedPlan.goalFinishMinutes != null ? String(Math.floor(sharedPlan.goalFinishMinutes / 60)) : '');
    setGoalMinutes(sharedPlan.goalFinishMinutes != null ? String(sharedPlan.goalFinishMinutes % 60) : '');
    setNotes(buildNotesWithDetectedCutoffs(sharedPlan.gpxRoute?.waypoints ?? [], sharedPlan.crewNotes ?? {}));
    // This is the plan loading in, not a person editing anything — the
    // autosave effect below shouldn't treat it as a change to save.
    skipNextAutosaveRef.current = true;
  }, [isShared, sharedPlan]);

  const waypoints = plan?.gpxRoute?.waypoints ?? [];
  // Some course files include an "ALTERNATE" waypoint at essentially the
  // same location as a real station (BigFoot 200's "Spencer Butte
  // ALTERNATE" is exactly this) — it's not a distinct stop in the race's
  // narrative sequence, so both "miles to next stop" and the Segment Info
  // link need to look past it to the next REAL station, not just the
  // literal next waypoint in the array. Without this, everything after
  // the alternate point would be off by one.
  const isAlternateWaypointName = (name: string) => /\balternate\b/i.test(name);
  const realWaypointIndices = waypoints.reduce<number[]>((acc, wp, idx) => {
    if (!isAlternateWaypointName(wp.name)) acc.push(idx);
    return acc;
  }, []);
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
  // The actual projected finish time, accounting for every rest/sleep
  // entry and pace override on the course — not just the flat goal. When
  // there are no named aid stations there's nowhere to enter an override,
  // so this collapses to the flat goal exactly. Extends the same
  // cascading calculation one mile further than the last named station if
  // that station isn't already right at the finish line, so this stays
  // correct even when a course file's last waypoint falls short of the
  // true finish.
  const projectedFinishMinutes = (() => {
    if (goalFinishMinutes == null) return null;
    if (waypoints.length === 0 || totalMiles <= 0) return goalFinishMinutes;
    const miles = waypoints.map((wp) => wp.mile);
    const rests = waypoints.map((_, i) => (Number(notes[String(i)]?.restHours) || 0) * 60 + (Number(notes[String(i)]?.restMinutes) || 0));
    const paceOverrides = waypoints.map((_, i) => {
      const note = notes[String(i)];
      if (!note?.avgPaceMin && !note?.avgPaceSec) return null;
      return (Number(note.avgPaceMin) || 0) + (Number(note.avgPaceSec) || 0) / 60;
    });
    if (miles[miles.length - 1] < totalMiles - 0.05) {
      miles.push(totalMiles);
      rests.push(0);
      paceOverrides.push(null);
    }
    const extended = computeStationTimings(miles, totalMiles, goalFinishMinutes, rests, paceOverrides);
    return extended[extended.length - 1].elapsedMinutes;
  })();
  const projectedFinishEta =
    projectedFinishMinutes != null && raceDate && raceStartTime ? formatEtaClock(raceDate, raceStartTime, projectedFinishMinutes) : null;
  const totalRestMinutes = waypoints.reduce(
    (sum, _, i) => sum + (Number(notes[String(i)]?.restHours) || 0) * 60 + (Number(notes[String(i)]?.restMinutes) || 0),
    0,
  );
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

  // Autosave — a crew member editing notes mid-race on spotty signal
  // shouldn't be able to lose that work just because they forgot to tap
  // "Save crew plan" before their connection dropped or they navigated
  // away. Debounced 1.5s after the last change so it doesn't hammer the
  // database on every keystroke; skips the very first change-detection
  // pass after mount or after a shared plan's data first loads in, since
  // that's the plan arriving, not someone editing it. handleSave is a
  // hoisted function declaration (defined further down in this
  // component), so referencing it here is safe despite the textual
  // order — this MUST stay above any early return below, or React throws
  // "rendered fewer/more hooks than expected" the moment a render takes
  // a different early-return path than the previous one did (exactly
  // what happened when this was accidentally placed after one).
  useEffect(() => {
    if (!plan || readOnlyMode) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    setAutosaveStatus('pending');
    const timer = setTimeout(() => {
      setAutosaveStatus('saving');
      handleSave()
        .then(() => setAutosaveStatus('saved'))
        .catch(() => setAutosaveStatus('error'));
    }, 1500);
    return () => clearTimeout(timer);
    // Deliberately narrow — only the actual editable fields should
    // trigger a save; re-running this because e.g. weather data loaded
    // in would autosave nothing new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, raceDate, raceStartTime, goalHours, goalMinutes]);

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

  function toggleNoteFlag(key: string, field: 'dropBag' | 'pacerPickup') {
    setNotes((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyNote), [field]: !(prev[key]?.[field] ?? false) } }));
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
      skipNextAutosaveRef.current = true;
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
      await inviteCrewMember(state.userId, plan.id, inviteEmail.trim(), inviteAsChief);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not send that invite.');
      setInviteSaving(false);
      return;
    }
    // The invite itself succeeded at this point — a failure refreshing
    // the list afterward is a separate, less serious problem and
    // shouldn't be reported as "the invite failed" when it didn't.
    setInviteEmail('');
    setInviteAsChief(false);
    try {
      setCrewAccessList(await fetchCrewAccessList(plan.id));
    } catch (err) {
      setInviteError(
        `Invite sent, but couldn't refresh the list to show it: ${err instanceof Error ? err.message : 'unknown error'}. Reloading the page should show it.`,
      );
    } finally {
      setInviteSaving(false);
    }
  }

  async function handlePromote(accessId: string) {
    if (!plan?.id) return;
    setPromotingId(accessId);
    try {
      await promoteToChief(plan.id, accessId);
      setCrewAccessList(await fetchCrewAccessList(plan.id));
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not update Chief Crew.');
    } finally {
      setPromotingId(null);
    }
  }

  async function handleRemoveAccess(accessId: string) {
    if (!plan?.id) return;
    await removeCrewAccess(accessId);
    setCrewAccessList(await fetchCrewAccessList(plan.id));
  }

  return (
    <>
      <Button
        variant="ghost"
        className="rg-print-hide"
        onClick={() => navigate(isShared ? '/shared-plans' : '/home')}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        ← Back to {isShared ? 'shared plans' : 'summary'}
      </Button>

      {readOnlyMode && lockState && (
        <div className="rg-cp-lock-banner rg-print-hide">
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <rect x="5" y="11" width="14" height="9" rx="1.5" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            <strong>{lockState.name || 'Someone'}</strong> is currently editing this plan — you can view everything
            below, but editing is locked until they finish or their session times out. This page checks
            automatically and will unlock as soon as it's free.
          </span>
        </div>
      )}

      <div className="rg-cp-header-card">
        <div className="rg-cp-header-top" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="rg-cp-race-name">Crew Plan for {plan.raceName}</div>
            {plan.gpxRoute && (
              <div className="rg-cp-muted">
                {plan.gpxRoute.distanceMiles} mi course · {plan.gpxRoute.elevationGainFt.toLocaleString()} ft gain ·{' '}
                {plan.gpxRoute.elevationLossFt.toLocaleString()} ft loss
              </div>
            )}
          </div>
          <div className="rg-print-hide" style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
            {!isShared && (
              <Button variant="secondary" disabled={readOnlyMode} onClick={() => setCrewModalOpen(true)}>
                Manage Crew
              </Button>
            )}
          </div>
        </div>

        <div className={`rg-cp-gpx-row${readOnlyMode ? ' rg-cp-readonly' : ''}`}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Course file</div>
            <div className="rg-cp-muted" style={{ fontSize: 13 }}>
              {plan.gpxRoute
                ? `${plan.gpxRoute.fileName} — ${waypoints.length} aid station${waypoints.length === 1 ? '' : 's'} found`
                : 'No GPX uploaded yet.'}
            </div>
            {isShared && myCrewRole !== null && myCrewRole !== 'chief' && (
              <div className="rg-cp-muted" style={{ fontSize: 12, marginTop: 2 }}>
                Only the plan owner or Chief Crew can replace this file.
              </div>
            )}
          </div>
          {(!isShared || myCrewRole === 'chief') && (
            <div style={{ flex: 'none' }}>
              <Button variant="secondary" disabled={gpxLoading} onClick={() => fileInputRef.current?.click()}>
                {gpxLoading ? 'Reading file…' : plan.gpxRoute ? 'Replace GPX' : 'Upload GPX'}
              </Button>
              <input ref={fileInputRef} type="file" accept=".gpx" onChange={handleGpxReplace} style={{ display: 'none' }} />
            </div>
          )}
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

        <div className={`rg-cp-setup-grid${readOnlyMode ? ' rg-cp-readonly' : ''}`}>
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

      {!isShared && crewModalOpen && (
        <div className="rg-cp-crew-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCrewModalOpen(false)}>
          <div className="rg-cp-crew-modal-card" role="dialog" aria-modal="true" aria-label="Manage crew">
            <div className="rg-cp-crew-modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Crew members</h3>
                <p className="rg-cp-muted" style={{ fontSize: 13, margin: '2px 0 0' }}>
                  Invite people to view and edit this Crew Plan. They'll get access automatically the next time they
                  sign in with this email — there's no email sent by the app, so let them know directly.
                </p>
              </div>
              <button type="button" className="rg-cp-crew-modal-close" aria-label="Close" onClick={() => setCrewModalOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
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
            <label className="rg-cp-flag">
              <input type="checkbox" checked={inviteAsChief} onChange={(e) => setInviteAsChief(e.target.checked)} />
              Make Chief Crew — only they can upload/replace the course GPX file
            </label>
            {inviteAsChief && crewAccessList.some((c) => c.role === 'chief') && (
              <p className="rg-cp-muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
                There's only one Chief Crew per plan — sending this will hand the role over from whoever has it now.
              </p>
            )}
            {inviteError && (
              <div className="rg-auth-error" style={{ marginTop: 'var(--space-3)' }}>
                {inviteError}
              </div>
            )}
            {crewAccessList.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
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
                        ({c.status === 'accepted' ? 'active' : 'invited, not yet signed in'}
                        {c.role === 'chief' ? ' · Chief Crew' : ''})
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {c.role !== 'chief' && (
                        <Button variant="ghost" disabled={promotingId === c.id} onClick={() => handlePromote(c.id)}>
                          {promotingId === c.id ? 'Making chief…' : 'Make Chief'}
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => handleRemoveAccess(c.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {goalFinishMinutes != null && initialPaceMinPerMile != null && (
        <div className="rg-cp-pace-callout">
          <div className="rg-cp-pace-callout-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              <circle cx="12" cy="12" r="9" strokeWidth="2" />
              <path d="M12 7v5l3.5 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="rg-cp-pace-callout-body">
            <div className="rg-cp-pace-callout-primary">
              Target pace <strong>{formatPaceMinPerMile(initialPaceMinPerMile)}</strong> to finish in{' '}
              <strong>{formatElapsedLabel(goalFinishMinutes)}</strong>
            </div>
            {(projectedFinishEta || totalRestMinutes > 0) && (
              <div className="rg-cp-pace-callout-secondary-row">
                {projectedFinishEta && (
                  <span>
                    Projected finish: <strong>{projectedFinishEta}</strong>
                  </span>
                )}
                {totalRestMinutes > 0 && (
                  <span>
                    Total planned rest/sleep: <strong>{formatElapsedLabel(totalRestMinutes)}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
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

          <div className={`rg-cp-stations${readOnlyMode ? ' rg-cp-readonly' : ''}`}>
            {waypoints.map((wp, i) => {
              const key = String(i);
              const note = notes[key] ?? emptyNote;
              const elapsed = elapsedByIndex[i];
              const arrival = elapsed != null ? predictedArrivalDate(raceDate, raceStartTime, elapsed) : null;
              const eta = elapsed != null && raceStartTime ? formatEtaClock(raceDate, raceStartTime, elapsed) : null;
              const isAlternate = isAlternateWaypointName(wp.name);
              const realPos = realWaypointIndices.indexOf(i);
              const nextRealIdx = !isAlternate && realPos !== -1 ? realWaypointIndices[realPos + 1] : undefined;
              const nextSegmentMiles = nextRealIdx != null ? Math.max(0, Math.round((waypoints[nextRealIdx].mile - wp.mile) * 10) / 10) : null;
              const segmentInfoIndex = !isAlternate && realPos !== -1 && realPos < BIGFOOT_200_SEGMENTS.length ? realPos : null;
              return (
                <div key={key} className="rg-cp-station-card">
                  <div className="rg-cp-station-head">
                    <div>
                      <div className="rg-cp-station-name">{wp.name}</div>
                      <div className="rg-cp-station-meta">
                        Mile {wp.mile}
                        {wp.elevationFt != null ? ` | ${wp.elevationFt.toLocaleString()} ft` : ''}
                      </div>
                      {nextSegmentMiles != null && (
                        <div className="rg-cp-station-next-leg">
                          {nextSegmentMiles} mi to next stop
                          {segmentInfoIndex != null && (
                            <>
                              {' · '}
                              <button
                                type="button"
                                className="rg-cp-segment-link"
                                onClick={() => setSelectedSegment(BIGFOOT_200_SEGMENTS[segmentInfoIndex])}
                              >
                                Segment info
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {(() => {
                        const cleanDescription = stripCutoffMention(wp.description);
                        const cleanComment = stripCutoffMention(wp.comment);
                        return (
                          (cleanDescription || cleanComment || wp.symbol || wp.waypointType || (wp.lat != null && wp.lon != null)) && (
                            <div className="rg-cp-station-meta" style={{ marginTop: 4 }}>
                              {cleanDescription && <div>{cleanDescription}</div>}
                              {cleanComment && <div>Note: {cleanComment}</div>}
                              {(wp.symbol || wp.waypointType) && (
                                <div>
                                  {[wp.symbol, wp.waypointType].filter(Boolean).join(' · ')}
                                </div>
                              )}
                              {wp.lat != null && wp.lon != null && (
                                <div>
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${wp.lat},${wp.lon}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'inherit', textDecoration: 'underline' }}
                                  >
                                    {wp.lat.toFixed(5)}, {wp.lon.toFixed(5)} — directions
                                  </a>
                                </div>
                              )}
                            </div>
                          )
                        );
                      })()}
                    </div>
                    {(elapsed != null || note.cutoff) && (
                      <div className="rg-cp-station-eta">
                        {elapsed != null &&
                          (eta ? (
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
                          ))}
                        {note.cutoff && (
                          <div className="rg-cp-cutoff-warning">
                            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                              <circle cx="12" cy="12" r="9" strokeWidth="2" />
                              <path d="M12 7v5l3.5 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Cutoff: {note.cutoff}
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
                    <div className="rg-cp-cutoff-field">
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
                    </div>
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
                          One-time stop here — delays every station after this one by{' '}
                          {formatElapsedLabel((Number(note.restHours) || 0) * 60 + (Number(note.restMinutes) || 0))} (not repeated at those stations).
                          {projectedFinishEta && (
                            <>
                              {' '}
                              Overall, you're now projected to finish <strong>{projectedFinishEta}</strong>.
                            </>
                          )}
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
                          Applies from here onward, until a later station sets a different pace.
                          {projectedFinishEta && (
                            <>
                              {' '}
                              Overall, you're now projected to finish <strong>{projectedFinishEta}</strong>.
                            </>
                          )}
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

                  <div className="rg-cp-flags-row">
                    <label className="rg-cp-flag">
                      <input type="checkbox" checked={note.dropBag ?? false} onChange={() => toggleNoteFlag(key, 'dropBag')} />
                      Drop bag here
                    </label>
                    <label className="rg-cp-flag">
                      <input type="checkbox" checked={note.pacerPickup ?? false} onChange={() => toggleNoteFlag(key, 'pacerPickup')} />
                      Pacer pickup here
                    </label>
                  </div>

                  <div className="rg-cp-station-notes">
                    <Field label="Nutrition">
                      <TextArea rows={2} value={note.nutrition} onChange={(e) => updateNoteField(key, 'nutrition', e.target.value)} />
                    </Field>
                    <Field label="Hydration">
                      <TextArea rows={2} value={note.hydration} onChange={(e) => updateNoteField(key, 'hydration', e.target.value)} />
                    </Field>
                    <Field label="Gear">
                      <TextArea rows={2} value={note.gear} onChange={(e) => updateNoteField(key, 'gear', e.target.value)} />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rg-cp-save-footer rg-print-hide" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {readOnlyMode ? (
              <span className="rg-cp-muted" style={{ fontSize: 13 }}>
                Viewing in read-only mode while {lockState?.name || 'someone else'} is editing.
              </span>
            ) : (
              <>
                <Button
                  variant="primary"
                  disabled={saving}
                  onClick={() => {
                    skipNextAutosaveRef.current = true; // this manual save covers it, no need for autosave to also fire
                    handleSave();
                  }}
                >
                  {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save crew plan'}
                </Button>
                <span className="rg-cp-muted" style={{ fontSize: 13 }}>
                  {autosaveStatus === 'pending' && 'Unsaved changes…'}
                  {autosaveStatus === 'saving' && 'Autosaving…'}
                  {autosaveStatus === 'saved' && 'All changes saved automatically'}
                  {autosaveStatus === 'error' && "Couldn't autosave — check your connection, or tap Save crew plan"}
                </span>
              </>
            )}
          </div>
        </>
      )}

      {selectedSegment && (
        <div className="rg-cp-crew-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setSelectedSegment(null)}>
          <div className="rg-cp-crew-modal-card rg-cp-segment-modal-card" role="dialog" aria-modal="true" aria-label="Segment info">
            <div className="rg-cp-crew-modal-header">
              <div>
                <h3 style={{ margin: 0 }}>{selectedSegment.title}</h3>
                <p className="rg-cp-muted" style={{ fontSize: 13, margin: '2px 0 0' }}>
                  {selectedSegment.distanceMiles} mi · +{selectedSegment.ascentFt.toLocaleString()} ft / -
                  {selectedSegment.descentFt.toLocaleString()} ft
                </p>
              </div>
              <button type="button" className="rg-cp-crew-modal-close" aria-label="Close" onClick={() => setSelectedSegment(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p style={{ margin: '0 0 var(--space-4)' }}>{selectedSegment.description}</p>
            <img
              src={selectedSegment.profileImage}
              alt={`${selectedSegment.title} elevation profile`}
              style={{ width: '100%', borderRadius: 10, border: '1px solid var(--color-divider)', display: 'block' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
