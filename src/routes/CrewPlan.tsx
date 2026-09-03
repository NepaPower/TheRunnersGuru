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
  resolveCourseSegmentImage,
  uploadCourseSegmentImage,
  deleteCourseSegmentImage,
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
  cutoffToElapsedMinutes,
  requiredPaceMinPerMile,
  getDatePartsInZone,
} from '../lib/crewPlan';
import {
  fetchClimateAverage,
  fetchDayTemperatureSlots,
  forecastAvailableFromLabel,
  isWithinForecastHorizon,
  resolveCourseTimeZone,
  type ClimateAverage,
  type DaySlotForecast,
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
  mileOverride: '',
  restHours: '',
  restMinutes: '',
  avgPaceMin: '',
  avgPaceSec: '',
  dropBag: false,
  pacerPickup: false,
};

// Editor-side shape for a course segment — numeric fields held as strings
// so a half-typed "12." doesn't get coerced mid-edit. Converted to/from
// the persisted CourseSegment (real numbers) at the state boundary.
type SegmentDraft = {
  title: string;
  distanceMiles: string;
  ascentFt: string;
  descentFt: string;
  description: string;
  profileImage: string;
};
const toSegmentDraft = (s: CourseSegment): SegmentDraft => ({
  title: s.title,
  distanceMiles: s.distanceMiles ? String(s.distanceMiles) : '',
  ascentFt: s.ascentFt ? String(s.ascentFt) : '',
  descentFt: s.descentFt ? String(s.descentFt) : '',
  description: s.description,
  profileImage: s.profileImage,
});
const fromSegmentDraft = (d: SegmentDraft): CourseSegment => ({
  title: d.title.trim(),
  distanceMiles: Number(d.distanceMiles) || 0,
  ascentFt: Number(d.ascentFt) || 0,
  descentFt: Number(d.descentFt) || 0,
  description: d.description.trim(),
  profileImage: d.profileImage,
});
const emptySegmentDraft: SegmentDraft = {
  title: '',
  distanceMiles: '',
  ascentFt: '',
  descentFt: '',
  description: '',
  profileImage: '',
};
const emptyCourseSegment = (): CourseSegment => ({
  title: '',
  distanceMiles: 0,
  ascentFt: 0,
  descentFt: 0,
  description: '',
  profileImage: '',
});

interface StationWeather {
  climate: ClimateAverage | null;
  climateLoading: boolean;
  daySlots: DaySlotForecast[] | null;
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
/** Soft-pastel background + matching darker text per temperature band —
 * lets the 5-slot forecast row read as a cold-to-warm gradient at a
 * glance (useful for spotting "this station will be cold overnight")
 * without needing to actually read every number. Colored by each slot's
 * midpoint (avg of min/max), not by the more extreme end, since the
 * midpoint is the more representative "what will it generally feel like"
 * value for a whole multi-hour window. */
function tempSlotColors(avgF: number): { bg: string; text: string } {
  if (avgF < 32) return { bg: '#dbeafe', text: '#1e3a8a' }; // freezing
  if (avgF < 45) return { bg: '#e0f2fe', text: '#075985' }; // cold
  if (avgF < 55) return { bg: '#ecfeff', text: '#155e75' }; // cool
  if (avgF < 65) return { bg: '#ecfdf5', text: '#065f46' }; // mild
  if (avgF < 75) return { bg: '#fefce8', text: '#854d0e' }; // warm
  if (avgF < 85) return { bg: '#fff7ed', text: '#9a3412' }; // hot
  return { bg: '#fef2f2', text: '#991b1b' }; // very hot
}

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
  // The "Segment info" popup. `segPopupLeg` is the leg it's showing (the
  // leg AFTER real waypoint N); null when closed. For the owner / Chief
  // Crew the popup is an editor — `segForm` holds the in-progress draft
  // (numbers as strings, see SegmentDraft), seeded from the plan's own
  // segment, or text-only from whatever's currently displayed.
  // `segPopupImageUrl` is the resolved <img src> for the image the popup
  // is showing (undefined = still resolving, null = resolve failed).
  const [segPopupLeg, setSegPopupLeg] = useState<number | null>(null);
  const [segForm, setSegForm] = useState<SegmentDraft | null>(null);
  const [segPopupImageUrl, setSegPopupImageUrl] = useState<string | null>(null);
  const [segSaving, setSegSaving] = useState(false);
  const [segUploading, setSegUploading] = useState(false);
  const [segPopupError, setSegPopupError] = useState<string | null>(null);
  const segFileInputRef = useRef<HTMLInputElement>(null);

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

  // Resolved once per course, from its own starting coordinates — every
  // race-time calculation (ETAs, projected finish, and which hour of
  // weather to fetch) anchors to this, not to whatever timezone the
  // person viewing the page happens to be in. That distinction matters
  // for exactly the audience this feature serves: crew checking the plan
  // from home, often in a different timezone than the race itself.
  const [courseTimeZone, setCourseTimeZone] = useState<string | null>(null);
  useEffect(() => {
    const startWp = plan?.gpxRoute?.waypoints?.find((wp) => wp.lat != null && wp.lon != null);
    if (!startWp || startWp.lat == null || startWp.lon == null) return;
    let cancelled = false;
    resolveCourseTimeZone(startWp.lat, startWp.lon).then((tz) => {
      if (!cancelled) setCourseTimeZone(tz);
    });
    return () => {
      cancelled = true;
    };
  }, [plan?.gpxRoute?.waypoints]);

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
  // Per-leg "Segment info" cards come from plan.courseSegments when the
  // plan has its own set (works for any race). Otherwise fall back to the
  // built-in BIGFOOT_200_SEGMENTS — but only for the actual BigFoot 200
  // plan: that data is matched to waypoints purely by ORDER, so without a
  // guard it would render BigFoot's legs on any other race's first ~13
  // stations. Require BOTH a name match AND an exact leg-count match. This
  // fallback goes away once BigFoot is migrated into courseSegments (see
  // crew-plan-centerpiece-spec.md).
  const bigfootSegmentsApply =
    /bigfoot/i.test(plan?.raceName ?? '') && realWaypointIndices.length - 1 === BIGFOOT_200_SEGMENTS.length;
  const effectiveSegments: CourseSegment[] | null =
    plan?.courseSegments ?? (bigfootSegmentsApply ? BIGFOOT_200_SEGMENTS : null);
  // Owner (own plan) or the plan's Chief Crew. The bucket RLS + the
  // enforce_course_setup_chief_only trigger are the real enforcement —
  // this just decides whether the "Segment info" popup opens as an editor
  // and whether the per-leg "Add segment info" affordance shows.
  const canEditSegments = !isShared || myCrewRole === 'chief';
  const legCount = Math.max(0, realWaypointIndices.length - 1);

  // Resolve the image the Segment info popup is showing to a displayable
  // src — the in-progress upload while editing, otherwise the displayed
  // segment's own image. A private-bucket upload needs a signed URL; a
  // bundled BigFoot asset URL passes straight through. undefined src =
  // still resolving; null = resolve failed.
  const segPopupImageRef =
    segPopupLeg == null
      ? undefined
      : canEditSegments && !readOnlyMode
        ? segForm?.profileImage || undefined
        : effectiveSegments?.[segPopupLeg]?.profileImage;
  useEffect(() => {
    setSegPopupImageUrl(null);
    if (!segPopupImageRef) return;
    let cancelled = false;
    resolveCourseSegmentImage(segPopupImageRef).then((url) => {
      if (!cancelled) setSegPopupImageUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [segPopupImageRef]);
  // A station's mile marker, preferring the user's manual correction
  // (entered when the GPX file's nearest-track-point estimate is known to
  // be off) over the GPX-derived value. EVERY calculation that needs a
  // station's position on the course — segment distance, elapsed/pace
  // timing, cutoff-pace math — should call this instead of reading
  // waypoints[i].mile directly, so one correction cascades everywhere.
  const effectiveMile = (i: number): number => {
    const raw = notes[String(i)]?.mileOverride;
    const parsed = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : waypoints[i].mile;
  };
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
          waypoints.map((_, i) => effectiveMile(i)),
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
    const miles = waypoints.map((_, i) => effectiveMile(i));
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
    projectedFinishMinutes != null && raceDate && raceStartTime ? formatEtaClock(raceDate, raceStartTime, projectedFinishMinutes, courseTimeZone) : null;
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
  // Each station's own cutoff, expressed as elapsed-minutes-from-race-
  // start (same basis as elapsedByIndex) — computed once so the
  // required-pace calc below can look either station's cutoff up
  // directly instead of re-parsing text twice per pair.
  const cutoffElapsedByIndex: (number | null)[] = waypoints.map((_, i) => {
    if (raceStartWeekdayIndex == null || !raceStartTime) return null;
    const text = notes[String(i)]?.cutoff || '';
    if (!text) return null;
    const orderMinutes = parseCutoffOrderMinutes(text, raceStartWeekdayIndex);
    if (orderMinutes == null) return null;
    return cutoffToElapsedMinutes(orderMinutes, raceStartTime);
  });
  // For every station with a cutoff, the average pace that leg DEMANDS —
  // computed cutoff-to-cutoff: the distance from the previous station to
  // this one, divided by the time between the previous station's own
  // cutoff and this station's cutoff. This is a property of the race's
  // official cutoff schedule itself, independent of how the runner is
  // actually pacing — e.g. Spencer Butte cutoff Sun 4:00 PM to Lewis
  // River cutoff Sun 8:00 PM over 7.9mi is a fixed 30:22/mi regardless of
  // anyone's current pace. Falls back to the runner's actual predicted
  // departure (arrival + rest) from the previous station only when that
  // station has no cutoff of its own to anchor to; falls back to the
  // race start (elapsed 0) for the very first station. Distinct from
  // `timings[i].paceUsedMinPerMile`, which is the pace the CURRENT plan
  // assumes for this segment.
  const requiredCutoffPaceByIndex: (number | null)[] = waypoints.map((_, i) => {
    const cutoffElapsed = cutoffElapsedByIndex[i];
    if (cutoffElapsed == null) return null;
    const prevMile = i > 0 ? effectiveMile(i - 1) : 0;
    const segmentMiles = effectiveMile(i) - prevMile;
    let startElapsed: number | null;
    if (i === 0) {
      startElapsed = 0;
    } else if (cutoffElapsedByIndex[i - 1] != null) {
      startElapsed = cutoffElapsedByIndex[i - 1];
    } else {
      const prevArrival = elapsedByIndex[i - 1] ?? null;
      const prevRest = (Number(notes[String(i - 1)]?.restHours) || 0) * 60 + (Number(notes[String(i - 1)]?.restMinutes) || 0);
      startElapsed = prevArrival != null ? prevArrival + prevRest : null;
    }
    if (startElapsed == null) return null;
    return requiredPaceMinPerMile(startElapsed, cutoffElapsed, segmentMiles);
  });

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
      const arrival = predictedArrivalDate(raceDate, raceStartTime, elapsed, courseTimeZone);
      if (!arrival) return;
      const { year: y, month: mo, day: d, hour: h } = courseTimeZone
        ? getDatePartsInZone(arrival, courseTimeZone)
        : { year: arrival.getFullYear(), month: arrival.getMonth() + 1, day: arrival.getDate(), hour: arrival.getHours() };
      const monthDayLabel = arrival.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: courseTimeZone ?? undefined });
      const forecastEligible = isWithinForecastHorizon(y, mo, d);

      setWeather((prev) => ({
        ...prev,
        [key]: {
          climate: prev[key]?.climate ?? null,
          daySlots: prev[key]?.daySlots ?? null,
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
        fetchDayTemperatureSlots(wp.lat, wp.lon, y, mo, d).then((daySlots) => {
          if (cancelled) return;
          setWeather((prev) => ({ ...prev, [key]: { ...prev[key], daySlots, forecastLoading: false } }));
        });
      }
    });

    return () => {
      cancelled = true;
    };
    // Re-runs when the inputs that change the predicted arrival date/time
    // change — waypoints/totalMiles are derived from plan.gpxRoute, which
    // is included via `plan` itself. Also re-runs once courseTimeZone
    // resolves (starts null), so weather already fetched using the
    // browser-timezone fallback gets corrected rather than left stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, raceDate, raceStartTime, goalFinishMinutes, restSignature, courseTimeZone]);

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
    field: 'nutrition' | 'hydration' | 'gear' | 'cutoff' | 'mileOverride' | 'restHours' | 'restMinutes' | 'avgPaceMin' | 'avgPaceSec',
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

  // ─── "Segment info" popup — view for everyone, edit for owner / chief ──
  // Opens the popup for the leg after real waypoint `leg`. The editor
  // form is seeded from whatever's currently displayed for that leg — the
  // plan's own saved segment, or the built-in BigFoot fallback when the
  // plan has none yet, so editing one leg of a BigFoot plan doesn't wipe
  // the rest (buildSegmentsArray snapshots the whole set on first save).
  function openSegmentPopup(leg: number) {
    const src = plan?.courseSegments?.[leg] ?? effectiveSegments?.[leg];
    setSegForm(src ? toSegmentDraft(src) : { ...emptySegmentDraft });
    setSegPopupError(null);
    setSegPopupLeg(leg);
  }
  function closeSegmentPopup() {
    setSegPopupLeg(null);
    setSegForm(null);
    setSegPopupError(null);
  }
  function pickSegmentImage() {
    segFileInputRef.current?.click();
  }
  async function handleSegmentImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !plan?.id || !segForm) return;
    setSegPopupError(null);
    setSegUploading(true);
    try {
      const prevRef = segForm.profileImage;
      const ref = await uploadCourseSegmentImage(plan.id, file);
      if (prevRef) deleteCourseSegmentImage(prevRef);
      setSegForm((f) => (f ? { ...f, profileImage: ref } : f));
    } catch (err) {
      setSegPopupError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setSegUploading(false);
    }
  }
  function removeSegmentImage() {
    setSegForm((f) => {
      if (f?.profileImage) deleteCourseSegmentImage(f.profileImage);
      return f ? { ...f, profileImage: '' } : f;
    });
  }
  // courseSegments is stored as a dense array, one entry per leg, indexed
  // by leg — so a segment can't drift out of alignment with its leg. When
  // the plan has no segments of its own yet, fall back through
  // effectiveSegments so the first edit on a BigFoot plan snapshots the
  // whole built-in set rather than blanking the 12 legs left untouched.
  function buildSegmentsArray(): CourseSegment[] {
    return Array.from({ length: legCount }, (_, i) => plan?.courseSegments?.[i] ?? effectiveSegments?.[i] ?? emptyCourseSegment());
  }
  async function persistCourseSegments(next: CourseSegment[]) {
    if (isShared) {
      if (!plan?.id) return;
      await updateCrewPlanById(plan.id, { courseSegments: next });
      setSharedPlan((prev) => (prev ? { ...prev, courseSegments: next } : prev));
    } else {
      if (!state.userId) return;
      await updateCrewPlan(state.userId, { courseSegments: next });
      dispatch({ type: 'TRAINING_PLAN_UPDATED', patch: { courseSegments: next } });
    }
  }
  async function saveSegment() {
    if (segPopupLeg == null || !segForm) return;
    const next = buildSegmentsArray();
    next[segPopupLeg] = fromSegmentDraft(segForm);
    setSegSaving(true);
    setSegPopupError(null);
    try {
      await persistCourseSegments(next);
      closeSegmentPopup();
    } catch (err) {
      setSegPopupError(
        err instanceof Error ? err.message : "Couldn't save — you may not have permission, or the connection dropped.",
      );
    } finally {
      setSegSaving(false);
    }
  }
  async function clearSegment() {
    if (segPopupLeg == null) return;
    const next = buildSegmentsArray();
    const removed = next[segPopupLeg];
    next[segPopupLeg] = emptyCourseSegment();
    setSegSaving(true);
    setSegPopupError(null);
    try {
      await persistCourseSegments(next);
      if (removed?.profileImage) deleteCourseSegmentImage(removed.profileImage);
      closeSegmentPopup();
    } catch (err) {
      setSegPopupError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSegSaving(false);
    }
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
      // Course segments are matched to legs by order too, so the same
      // reasoning applies — drop them (and their uploaded images) on a
      // GPX swap. Only reachable for owner / chief, so the trigger allows
      // writing course_segments here.
      const staleSegmentImages = (plan.courseSegments ?? []).map((s) => s.profileImage).filter(Boolean);
      if (isShared) {
        if (!plan.id) return;
        await updateCrewPlanById(plan.id, { gpxRoute: route, crewNotes: freshNotes, courseSegments: null });
        setSharedPlan((prev) => (prev ? { ...prev, gpxRoute: route, crewNotes: freshNotes, courseSegments: null } : prev));
      } else {
        await updateCrewPlan(state.userId, { gpxRoute: route, crewNotes: freshNotes, courseSegments: null });
        dispatch({ type: 'TRAINING_PLAN_UPDATED', patch: { gpxRoute: route, crewNotes: freshNotes, courseSegments: null } });
      }
      setNotes(freshNotes);
      setSegPopupLeg(null);
      staleSegmentImages.forEach((ref) => deleteCourseSegmentImage(ref));
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
              <>
                <div className="rg-cp-muted">
                  {plan.gpxRoute.distanceMiles} mi course (from GPX) · {plan.gpxRoute.elevationGainFt.toLocaleString()} ft gain ·{' '}
                  {plan.gpxRoute.elevationLossFt.toLocaleString()} ft loss
                </div>
                {(() => {
                  // Only the LAST waypoint's own correction shifts the
                  // total — a correction to an earlier station just
                  // reshapes the segments on either side of it (their
                  // neighbors' absolute positions haven't moved), so it
                  // doesn't change how far the course runs overall. The
                  // last waypoint is the one closest to the actual
                  // finish line, so its correction is what the total
                  // should track.
                  if (waypoints.length === 0) return null;
                  const lastIdx = waypoints.length - 1;
                  const shift = effectiveMile(lastIdx) - waypoints[lastIdx].mile;
                  if (Math.abs(shift) <= 0.05) return null;
                  const correctedTotal = Math.round((totalMiles + shift) * 10) / 10;
                  return (
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent-800)', marginTop: 2 }}>
                      Updated total: {correctedTotal} mi (based on your mile corrections)
                    </div>
                  );
                })()}
              </>
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
          <p className="rg-cp-muted" style={{ marginBottom: 'var(--space-4)', fontSize: 13 }}>
            Historical average and short-range forecast are both pulled from each aid station's own GPS coordinates,
            not one estimate for the whole race — expect it to run noticeably colder at higher-elevation stations
            than at the trailhead, and plan gear (layers, gloves, etc.) station by station rather than for the race
            as a whole.
          </p>

          <div className="rg-cp-stations">
            {waypoints.map((wp, i) => {
              const key = String(i);
              const note = notes[key] ?? emptyNote;
              const elapsed = elapsedByIndex[i];
              const arrival = elapsed != null ? predictedArrivalDate(raceDate, raceStartTime, elapsed, courseTimeZone) : null;
              const eta = elapsed != null && raceStartTime ? formatEtaClock(raceDate, raceStartTime, elapsed, courseTimeZone) : null;
              const isAlternate = isAlternateWaypointName(wp.name);
              const realPos = realWaypointIndices.indexOf(i);
              const nextRealIdx = !isAlternate && realPos !== -1 ? realWaypointIndices[realPos + 1] : undefined;
              const nextSegmentMiles = nextRealIdx != null ? Math.max(0, Math.round((effectiveMile(nextRealIdx) - effectiveMile(i)) * 10) / 10) : null;
              // The leg leaving this station (leg N = after real waypoint N).
              const legIndex = !isAlternate && realPos !== -1 && realPos < legCount ? realPos : null;
              const legSegment = legIndex != null ? effectiveSegments?.[legIndex] : undefined;
              const legHasSegment = !!(legSegment && (legSegment.title || legSegment.description || legSegment.profileImage));
              const showSegmentLink = legIndex != null && (legHasSegment || (canEditSegments && !readOnlyMode));
              return (
                <div key={key} className="rg-cp-station-card">
                  <div className="rg-cp-station-head">
                    <div>
                      <div className="rg-cp-station-name">{wp.name}</div>
                      <div className="rg-cp-station-meta rg-cp-mile-inline">
                        Mile{' '}
                        <input
                          type="text"
                          inputMode="decimal"
                          className="rg-cp-mile-inline-input"
                          value={note.mileOverride ? note.mileOverride : String(wp.mile)}
                          onChange={(e) => updateNoteField(key, 'mileOverride', e.target.value.replace(/[^\d.]/g, ''))}
                          aria-label={`Mile marker for ${wp.name}`}
                        />
                        {note.mileOverride ? ' (edited)' : ' (from GPX)'}
                        {wp.elevationFt != null ? ` | ${wp.elevationFt.toLocaleString()} ft` : ''}
                      </div>
                      {nextSegmentMiles != null && (
                        <div className="rg-cp-station-next-leg">
                          {nextSegmentMiles} mi to next stop
                          {showSegmentLink && (
                            <>
                              {' · '}
                              <button type="button" className="rg-cp-segment-link" onClick={() => openSegmentPopup(legIndex!)}>
                                {legHasSegment ? 'Segment info' : 'Add segment info'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {elapsed != null && eta && (
                        <div className="rg-cp-elapsed-pace-line">
                          +{formatElapsedLabel(elapsed)} from start · {formatPaceMinPerMile(timings![i].paceUsedMinPerMile)} pace
                        </div>
                      )}
                      {(() => {
                        const cleanDescription = stripCutoffMention(wp.description);
                        const cleanComment = stripCutoffMention(wp.comment);
                        return (
                          (cleanDescription || cleanComment || wp.symbol || wp.waypointType) && (
                            <div className="rg-cp-station-meta" style={{ marginTop: 4 }}>
                              {cleanDescription && <div>{cleanDescription}</div>}
                              {cleanComment && <div>Note: {cleanComment}</div>}
                              {(wp.symbol || wp.waypointType) && (
                                <div>
                                  {[wp.symbol, wp.waypointType].filter(Boolean).join(' · ')}
                                </div>
                              )}
                            </div>
                          )
                        );
                      })()}
                    </div>
                    {(elapsed != null || note.cutoff || (wp.lat != null && wp.lon != null)) && (
                      <div className="rg-cp-station-eta">
                        {wp.lat != null && wp.lon != null && (
                          <div style={{ fontSize: 13, marginBottom: 6 }}>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${wp.lat},${wp.lon}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rg-cp-directions-link"
                            >
                              Driving directions to Aid Station
                            </a>
                          </div>
                        )}
                        {elapsed != null &&
                          (eta ? (
                            <div className="rg-cp-eta-value">You'll reach here on {eta}</div>
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
                        {note.cutoff &&
                          (() => {
                            const required = requiredCutoffPaceByIndex[i];
                            if (required == null) return null;
                            if (required <= 0) {
                              return (
                                <div className="rg-cp-required-pace rg-cp-required-pace-blown">
                                  ⚠ Already behind — this cutoff isn't reachable from the planned departure time
                                </div>
                              );
                            }
                            const planned = timings?.[i]?.paceUsedMinPerMile;
                            const tight = planned != null && required < planned;
                            return (
                              <div className={`rg-cp-required-pace ${tight ? 'rg-cp-required-pace-tight' : 'rg-cp-required-pace-ok'}`}>
                                Need {formatPaceMinPerMile(required)} to make this cutoff
                                {tight ? ' — faster than currently planned' : ''}
                              </div>
                            );
                          })()}
                      </div>
                    )}
                  </div>

                  <div className={`rg-cp-station-fields${readOnlyMode ? ' rg-cp-readonly' : ''}`}>
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
                          value={note.cutoff ?? ''}
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
                          value={note.restHours ?? ''}
                          onChange={(e) => updateNoteField(key, 'restHours', e.target.value.replace(/[^\d]/g, ''))}
                        />
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="min"
                          value={note.restMinutes ?? ''}
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
                          value={note.avgPaceMin ?? ''}
                          onChange={(e) => updateNoteField(key, 'avgPaceMin', e.target.value.replace(/[^\d]/g, ''))}
                        />
                        <span className="rg-cp-muted" style={{ fontSize: 13 }}>:</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="sec"
                          value={note.avgPaceSec ?? ''}
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
                            High{' '}
                            <span style={{ color: tempSlotColors(weather[key]!.climate!.avgHighF).text, fontWeight: 700 }}>
                              {weather[key]!.climate!.avgHighF}°F
                            </span>{' '}
                            / Low{' '}
                            <span style={{ color: tempSlotColors(weather[key]!.climate!.avgLowF).text, fontWeight: 700 }}>
                              {weather[key]!.climate!.avgLowF}°F
                            </span>
                            <span style={{ fontSize: 12 }}> (avg of last {weather[key]!.climate!.yearsUsed} years)</span>
                          </div>
                        ) : (
                          <div className="rg-cp-station-meta">Loading…</div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Short-range forecast</div>
                        {weather[key]?.forecastEligible ? (
                          weather[key]?.daySlots ? (
                            <>
                              <div className="rg-cp-day-slots">
                                {weather[key]!.daySlots!.map((slot) => {
                                  const colors = tempSlotColors((slot.minF + slot.maxF) / 2);
                                  const showRain = slot.maxPrecipProbability != null && slot.maxPrecipProbability >= 30;
                                  const heavyRain = slot.maxPrecipProbability != null && slot.maxPrecipProbability >= 60;
                                  const windMph = slot.maxGustMph ?? slot.maxWindMph;
                                  const isGust = slot.maxGustMph != null && (slot.maxWindMph == null || slot.maxGustMph > slot.maxWindMph + 5);
                                  const showWind = windMph != null && windMph >= 20;
                                  const heavyWind = windMph != null && windMph >= 35;
                                  return (
                                    <div key={slot.label} className="rg-cp-day-slot" style={{ background: colors.bg, color: colors.text }}>
                                      <div className="rg-cp-day-slot-label" style={{ color: colors.text, opacity: 0.75 }}>
                                        {slot.label}
                                      </div>
                                      <div className="rg-cp-day-slot-temp">
                                        {slot.minF === slot.maxF ? `${slot.minF}°` : `${slot.minF}–${slot.maxF}°`}
                                      </div>
                                      {(showRain || showWind) && (
                                        <div className="rg-cp-day-slot-alerts">
                                          {showRain && (
                                            <div className={`rg-cp-day-slot-alert${heavyRain ? ' rg-cp-day-slot-alert-strong' : ''}`}>
                                              ☔ {slot.maxPrecipProbability}%
                                            </div>
                                          )}
                                          {showWind && (
                                            <div className={`rg-cp-day-slot-alert${heavyWind ? ' rg-cp-day-slot-alert-strong' : ''}`}>
                                              💨 {windMph}mph{isGust ? ' gusts' : ''}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="rg-cp-muted" style={{ fontSize: 11, marginTop: 4 }}>
                                <span style={{ color: '#1e3a8a', fontWeight: 600 }}>Blue</span> = colder ·{' '}
                                <span style={{ color: '#065f46', fontWeight: 600 }}>green</span>/
                                <span style={{ color: '#854d0e', fontWeight: 600 }}>yellow</span> = mild ·{' '}
                                <span style={{ color: '#9a3412', fontWeight: 600 }}>orange</span>/
                                <span style={{ color: '#991b1b', fontWeight: 600 }}>red</span> = hotter ·{' '}
                                ☔ shown at 30%+ chance of rain · 💨 shown at 20+ mph sustained/gust — bold means 60%+ rain or 35+ mph
                              </div>
                            </>
                          ) : weather[key]?.forecastLoading ? (
                            <div className="rg-cp-station-meta">Loading…</div>
                          ) : (
                            <div className="rg-cp-station-meta">Not available</div>
                          )
                        ) : (
                          <div className="rg-cp-station-meta">
                            {arrival
                              ? `Available starting ${(() => {
                                  const parts = courseTimeZone
                                    ? getDatePartsInZone(arrival, courseTimeZone)
                                    : { year: arrival.getFullYear(), month: arrival.getMonth() + 1, day: arrival.getDate() };
                                  return forecastAvailableFromLabel(parts.year, parts.month, parts.day);
                                })()}`
                              : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={`rg-cp-flags-row${readOnlyMode ? ' rg-cp-readonly' : ''}`}>
                    <label className="rg-cp-flag">
                      <input type="checkbox" checked={note.dropBag ?? false} onChange={() => toggleNoteFlag(key, 'dropBag')} />
                      Drop bag here
                    </label>
                    <label className="rg-cp-flag">
                      <input type="checkbox" checked={note.pacerPickup ?? false} onChange={() => toggleNoteFlag(key, 'pacerPickup')} />
                      Pacer pickup here
                    </label>
                  </div>

                  <div className={`rg-cp-station-notes${readOnlyMode ? ' rg-cp-readonly' : ''}`}>
                    <Field label="Nutrition">
                      <TextArea rows={2} value={note.nutrition ?? ''} onChange={(e) => updateNoteField(key, 'nutrition', e.target.value)} />
                    </Field>
                    <Field label="Hydration">
                      <TextArea rows={2} value={note.hydration ?? ''} onChange={(e) => updateNoteField(key, 'hydration', e.target.value)} />
                    </Field>
                    <Field label="Gear">
                      <TextArea rows={2} value={note.gear ?? ''} onChange={(e) => updateNoteField(key, 'gear', e.target.value)} />
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

      {segPopupLeg != null &&
        (() => {
          const editing = canEditSegments && !readOnlyMode && segForm != null;
          const legName =
            segPopupLeg < legCount
              ? `${waypoints[realWaypointIndices[segPopupLeg]].name} → ${waypoints[realWaypointIndices[segPopupLeg + 1]].name}`
              : '';
          const view = effectiveSegments?.[segPopupLeg];
          const ownEntry = plan?.courseSegments?.[segPopupLeg];
          const canClear = !!(ownEntry && (ownEntry.title || ownEntry.description || ownEntry.profileImage));
          return (
            <div
              className="rg-cp-crew-modal-backdrop"
              onClick={(e) => e.target === e.currentTarget && !segSaving && closeSegmentPopup()}
            >
              <div
                className="rg-cp-crew-modal-card rg-cp-segment-modal-card"
                role="dialog"
                aria-modal="true"
                aria-label="Segment info"
              >
                <div className="rg-cp-crew-modal-header">
                  <div>
                    <h3 style={{ margin: 0 }}>{editing ? 'Segment info' : view?.title || 'Segment info'}</h3>
                    {legName && (
                      <p className="rg-cp-muted" style={{ fontSize: 13, margin: '2px 0 0' }}>
                        {legName}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="rg-cp-crew-modal-close"
                    aria-label="Close"
                    onClick={() => !segSaving && closeSegmentPopup()}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                      <path d="M6 6l12 12M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {editing && segForm ? (
                  <div className="rg-cp-seg-form">
                    <Field label="Title">
                      <Input
                        type="text"
                        value={segForm.title}
                        placeholder={legName}
                        onChange={(e) => setSegForm({ ...segForm, title: e.target.value })}
                      />
                    </Field>
                    <div className="rg-cp-seg-form-nums">
                      <Field label="Distance (mi)">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={segForm.distanceMiles}
                          onChange={(e) => setSegForm({ ...segForm, distanceMiles: e.target.value.replace(/[^\d.]/g, '') })}
                        />
                      </Field>
                      <Field label="Ascent (ft)">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={segForm.ascentFt}
                          onChange={(e) => setSegForm({ ...segForm, ascentFt: e.target.value.replace(/[^\d]/g, '') })}
                        />
                      </Field>
                      <Field label="Descent (ft)">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={segForm.descentFt}
                          onChange={(e) => setSegForm({ ...segForm, descentFt: e.target.value.replace(/[^\d]/g, '') })}
                        />
                      </Field>
                    </div>
                    <Field label="Description">
                      <TextArea
                        rows={5}
                        value={segForm.description}
                        placeholder="Terrain, water sources, exposure, what to expect on this leg…"
                        onChange={(e) => setSegForm({ ...segForm, description: e.target.value })}
                      />
                    </Field>
                    <div className="rg-cp-seg-form-image">
                      {segForm.profileImage ? (
                        <>
                          {segPopupImageUrl ? (
                            <img src={segPopupImageUrl} alt="" className="rg-cp-seg-thumb" />
                          ) : segPopupImageUrl === null ? (
                            <span className="rg-cp-muted" style={{ fontSize: 12 }}>
                              Image unavailable
                            </span>
                          ) : (
                            <span className="rg-cp-muted" style={{ fontSize: 12 }}>
                              Loading…
                            </span>
                          )}
                          <Button variant="ghost" disabled={segUploading} onClick={pickSegmentImage}>
                            {segUploading ? 'Uploading…' : 'Replace image'}
                          </Button>
                          <Button variant="ghost" disabled={segUploading} onClick={removeSegmentImage}>
                            Remove image
                          </Button>
                        </>
                      ) : (
                        <Button variant="secondary" disabled={segUploading} onClick={pickSegmentImage}>
                          {segUploading ? 'Uploading…' : 'Upload elevation image'}
                        </Button>
                      )}
                    </div>
                    {segPopupError && <div className="rg-auth-error">{segPopupError}</div>}
                    <div className="rg-cp-seg-form-actions">
                      {canClear && (
                        <Button variant="ghost" disabled={segSaving} onClick={clearSegment}>
                          Clear segment
                        </Button>
                      )}
                      <span style={{ flex: 1 }} />
                      <Button variant="ghost" disabled={segSaving} onClick={closeSegmentPopup}>
                        Cancel
                      </Button>
                      <Button variant="primary" disabled={segSaving || segUploading} onClick={saveSegment}>
                        {segSaving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {(view?.distanceMiles || view?.ascentFt || view?.descentFt) && (
                      <p className="rg-cp-muted" style={{ fontSize: 13, margin: '0 0 var(--space-3)' }}>
                        {view?.distanceMiles ? `${view.distanceMiles} mi` : ''}
                        {view?.ascentFt || view?.descentFt
                          ? ` · +${(view?.ascentFt ?? 0).toLocaleString()} ft / −${(view?.descentFt ?? 0).toLocaleString()} ft`
                          : ''}
                      </p>
                    )}
                    {view?.description && <p style={{ margin: '0 0 var(--space-4)' }}>{view.description}</p>}
                    {view?.profileImage ? (
                      segPopupImageUrl ? (
                        <img
                          src={segPopupImageUrl}
                          alt={`${view.title || 'Segment'} elevation profile`}
                          style={{ width: '100%', borderRadius: 10, border: '1px solid var(--color-divider)', display: 'block' }}
                        />
                      ) : (
                        <div className="rg-cp-muted" style={{ fontSize: 13 }}>
                          Loading elevation profile…
                        </div>
                      )
                    ) : (
                      !view?.description && (
                        <p className="rg-cp-muted" style={{ fontSize: 13, margin: 0 }}>
                          No details added for this leg yet.
                        </p>
                      )
                    )}
                  </>
                )}

                <input
                  ref={segFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSegmentImagePick}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          );
        })()}
    </>
  );
}
