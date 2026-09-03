import { supabase } from './supabaseClient';
import type { Address, CourseSegment, CrewAccessEntry, CrewNoteEntry, GpxRoute, LoggedRun, TrainingPlan } from '../types';
import { durationToSeconds, formatDurationParts } from './format';
import { buildPhaseSummary } from './planGenerator';

// ─── Auth ───────────────────────────────────────────────────────────────

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      // Without this, Supabase falls back to window.location.origin for
      // the confirmation-email link — which is just the bare domain
      // (e.g. https://nepapower.github.io) and excludes the "/TheRunnersGuru/"
      // subfolder this app is actually served from on GitHub Pages,
      // landing confirmed users on a 404 instead of the app.
      emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Fetches everything needed to hydrate local state for a signed-in user
 * in one call. Used both by AppContext (on load / on auth state change)
 * and directly by SignIn (so it can decide whether to route to onboarding
 * or the dashboard without racing the auth-state-change listener). Also
 * claims any pending crew invites addressed to this user's email — see
 * claimPendingInvites — so accepting an invite requires nothing more than
 * signing in with the invited address. */
export async function hydrateUserData(userId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData.session?.user.email ?? '';
  if (email) {
    // Best-effort — a failure here shouldn't block the rest of sign-in.
    try {
      await claimPendingInvites(userId, email);
    } catch {
      // ignore
    }
  }

  const [profile, ownPlans, loggedRuns, sharedPlans] = await Promise.all([
    fetchProfile(userId),
    fetchTrainingPlans(userId),
    fetchLoggedRuns(userId),
    fetchSharedPlans(userId),
  ]);
  // The race in focus at boot is the primary one (or the soonest, if none
  // is flagged). Screens still read state.trainingPlan until they're
  // ported to route by id.
  const trainingPlan = ownPlans.find((p) => p.isPrimary) ?? ownPlans[0] ?? null;
  return {
    name: profile?.name ?? '',
    address: {
      street: profile?.street ?? '',
      unit: profile?.unit ?? '',
      city: profile?.city ?? '',
      state: profile?.state ?? '',
      zip: profile?.zip ?? '',
      phone: profile?.phone ?? '',
    },
    garminConnected: profile?.garmin_connected ?? false,
    trainingPlan,
    ownPlans,
    loggedRuns,
    sharedPlans,
    email,
  };
}

// ─── Profile (name + address + garmin) ─────────────────────────────────

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProfileAddress(userId: string, name: string, address: Address) {
  const { error } = await supabase
    .from('profiles')
    .update({
      name,
      street: address.street,
      unit: address.unit,
      city: address.city,
      state: address.state,
      zip: address.zip,
      phone: address.phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw error;
}

export async function setGarminConnected(userId: string, connected: boolean) {
  const { error } = await supabase.from('profiles').update({ garmin_connected: connected }).eq('id', userId);
  if (error) throw error;
}

// ─── Training plan ───────────────────────────────────────────────────────

/** The column payload shared by create/replace of a training plan.
 * `is_primary` is set by the caller, not here. */
function planColumns(userId: string, plan: TrainingPlan) {
  return {
    user_id: userId,
    race_name: plan.raceName,
    distance_goal: plan.distanceGoal,
    ultra_miles: plan.ultraMiles != null ? Math.round(plan.ultraMiles) : null,
    first_time: plan.firstTime,
    hill_access: plan.hillAccess || null,
    gpx_route: plan.gpxRoute ?? null,
    race_date: plan.raceDate,
    race_start_time: plan.raceStartTime ?? null,
    goal_finish_minutes: plan.goalFinishMinutes ?? null,
    crew_notes: plan.crewNotes ?? {},
    course_segments: plan.courseSegments ?? null,
    total_weeks: plan.totalWeeks,
    quote: plan.quote,
  };
}

async function replaceWeekRows(planId: string, plan: TrainingPlan) {
  await supabase.from('training_plan_weeks').delete().eq('plan_id', planId);
  if (plan.rows.length === 0) return;
  const weekRows = plan.rows.map((r) => ({
    plan_id: planId,
    week_number: r.week,
    phase: r.phase,
    mon: r.mon,
    tue: r.tue,
    wed: r.wed,
    thu: r.thu,
    fri: r.fri,
    sat: r.sat,
    sun: r.sun,
    total_miles: r.totalMiles,
    total_hours: r.totalHours ?? null,
    is_race_week: r.isRaceWeek,
  }));
  const { error: weeksErr } = await supabase.from('training_plan_weeks').insert(weekRows);
  if (weeksErr) throw weeksErr;
}

/** Creates or replaces the user's PRIMARY race (the onboarding path).
 * A user has at most one primary plan; if one exists it's updated in
 * place, otherwise a new row is inserted. Additional (non-primary) races
 * go through createTrainingPlan instead. */
export async function saveTrainingPlan(userId: string, plan: TrainingPlan) {
  const { data: existing, error: findErr } = await supabase
    .from('training_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle();
  if (findErr) throw findErr;

  const columns = { ...planColumns(userId, plan), is_primary: true };
  const query = existing
    ? supabase.from('training_plans').update(columns).eq('id', existing.id)
    : supabase.from('training_plans').insert(columns);
  const { data: planRow, error: planErr } = await query.select().single();
  if (planErr) throw planErr;

  await replaceWeekRows(planRow.id, plan);
  return planRow;
}

/** Inserts an additional race (the "My Races → Add a race" path). Never
 * primary. Writes week rows only if the plan carries any (the short
 * add-a-race flow doesn't generate a weekly schedule). */
export async function createTrainingPlan(userId: string, plan: TrainingPlan) {
  const { data: planRow, error: planErr } = await supabase
    .from('training_plans')
    .insert({ ...planColumns(userId, plan), is_primary: false })
    .select()
    .single();
  if (planErr) throw planErr;
  await replaceWeekRows(planRow.id, plan);
  return planRow;
}

/** Saves "Edit race details" — the questionnaire answers (name, distance,
 * ultra miles, race date, goal time, first-time, hill access). Pass the
 * fully rebuilt plan; when `regenerateWeeks` is true the weekly schedule
 * rows are replaced too (only relevant for the primary race). Does not
 * touch crew_notes / course_segments. */
export async function updateRaceDetails(planId: string, plan: TrainingPlan, opts: { regenerateWeeks: boolean }) {
  const { error } = await supabase
    .from('training_plans')
    .update({
      race_name: plan.raceName,
      distance_goal: plan.distanceGoal,
      ultra_miles: plan.ultraMiles != null ? Math.round(plan.ultraMiles) : null,
      first_time: plan.firstTime,
      hill_access: plan.hillAccess || null,
      gpx_route: plan.gpxRoute ?? null,
      race_date: plan.raceDate,
      goal_finish_minutes: plan.goalFinishMinutes ?? null,
      total_weeks: plan.totalWeeks,
      quote: plan.quote,
    })
    .eq('id', planId);
  if (error) throw error;
  if (opts.regenerateWeeks) await replaceWeekRows(planId, plan);
}

/** Moves the "primary race" flag to `planId`. Clears the existing primary
 * first so the partial unique index (one is_primary per user) never sees
 * two; the brief zero-primary window in between is harmless. */
export async function setPrimaryRace(userId: string, planId: string) {
  const { error: clearErr } = await supabase
    .from('training_plans')
    .update({ is_primary: false })
    .eq('user_id', userId)
    .eq('is_primary', true);
  if (clearErr) throw clearErr;
  const { error: setErr } = await supabase.from('training_plans').update({ is_primary: true }).eq('id', planId);
  if (setErr) throw setErr;
}

/** Deletes one race. training_plan_weeks and crew_plan_access cascade via
 * FK; segment images in Storage don't, so clear course-segments/<planId>/
 * first (best-effort — a leftover object is harmless). */
export async function deleteTrainingPlan(planId: string) {
  try {
    const { data: objects } = await supabase.storage.from('course-segments').list(planId);
    if (objects && objects.length > 0) {
      await supabase.storage.from('course-segments').remove(objects.map((o) => `${planId}/${o.name}`));
    }
  } catch {
    // ignore — image cleanup shouldn't block the delete
  }
  const { error } = await supabase.from('training_plans').delete().eq('id', planId);
  if (error) throw error;
}

async function mapPlanRow(planRow: Record<string, any>): Promise<TrainingPlan> {
  const { data: weekRows, error: weeksErr } = await supabase
    .from('training_plan_weeks')
    .select('*')
    .eq('plan_id', planRow.id)
    .order('week_number', { ascending: true });
  if (weeksErr) throw weeksErr;

  return {
    id: planRow.id,
    isPrimary: planRow.is_primary ?? false,
    raceName: planRow.race_name,
    distanceGoal: planRow.distance_goal,
    ultraMiles: planRow.ultra_miles ?? null,
    firstTime: planRow.first_time,
    hillAccess: planRow.hill_access ?? '',
    gpxRoute: planRow.gpx_route ?? null,
    raceDate: planRow.race_date,
    raceStartTime: planRow.race_start_time ?? null,
    goalFinishMinutes: planRow.goal_finish_minutes ?? null,
    crewNotes: planRow.crew_notes ?? {},
    courseSegments: planRow.course_segments ?? null,
    totalWeeks: planRow.total_weeks,
    quote: planRow.quote ?? '',
    phases: buildPhaseSummary(planRow.total_weeks),
    rows: (weekRows ?? []).map((w) => ({
      week: w.week_number,
      phase: w.phase,
      mon: w.mon,
      tue: w.tue,
      wed: w.wed,
      thu: w.thu,
      fri: w.fri,
      sat: w.sat,
      sun: w.sun,
      totalMiles: Number(w.total_miles),
      totalHours: w.total_hours != null ? Number(w.total_hours) : undefined,
      isRaceWeek: w.is_race_week,
    })),
  };
}

/** Every race this user owns, primary first then soonest race date. */
export async function fetchTrainingPlans(userId: string): Promise<TrainingPlan[]> {
  const { data: rows, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('race_date', { ascending: true });
  if (error) throw error;
  return Promise.all((rows ?? []).map(mapPlanRow));
}

/** Back-compat shim — the user's primary race (or the soonest one if
 * somehow none is flagged primary). Prefer fetchTrainingPlans. */
export async function fetchTrainingPlan(userId: string): Promise<TrainingPlan | null> {
  const plans = await fetchTrainingPlans(userId);
  return plans.find((p) => p.isPrimary) ?? plans[0] ?? null;
}

/** Fetches a plan by its id rather than by owner — used for the Crew Plan
 * screen when viewed by an accepted crew member, who doesn't own the plan
 * themselves. RLS ("crew members can view shared plans") is what actually
 * enforces that only accepted crew can read it; this function doesn't
 * check that itself. Returns null if the plan doesn't exist or RLS denies
 * access (Supabase returns no row rather than an error in that case). */
export async function fetchTrainingPlanById(planId: string): Promise<{ plan: TrainingPlan; ownerUserId: string } | null> {
  const { data: planRow, error: planErr } = await supabase.from('training_plans').select('*').eq('id', planId).maybeSingle();
  if (planErr) throw planErr;
  if (!planRow) return null;
  const plan = await mapPlanRow(planRow);
  return { plan, ownerUserId: planRow.user_id };
}

/** Saves edits made on the Crew Plan screen — race start time, goal finish
 * time, and per-aid-station notes. Deliberately separate from
 * saveTrainingPlan: this never touches training_plan_weeks, since the plan
 * generated from onboarding never changes, only this crew-logistics layer
 * on top of it does. */
export async function updateCrewPlan(
  userId: string,
  updates: {
    raceDate?: string;
    raceStartTime?: string | null;
    goalFinishMinutes?: number | null;
    crewNotes?: Record<string, CrewNoteEntry>;
    courseSegments?: CourseSegment[] | null;
    gpxRoute?: GpxRoute | null;
  },
) {
  const patch: Record<string, unknown> = {};
  if ('raceDate' in updates && updates.raceDate) patch.race_date = updates.raceDate;
  if ('raceStartTime' in updates) patch.race_start_time = updates.raceStartTime ?? null;
  if ('goalFinishMinutes' in updates) patch.goal_finish_minutes = updates.goalFinishMinutes ?? null;
  if ('crewNotes' in updates) patch.crew_notes = updates.crewNotes ?? {};
  if ('courseSegments' in updates) patch.course_segments = updates.courseSegments ?? null;
  if ('gpxRoute' in updates) patch.gpx_route = updates.gpxRoute ?? null;

  const { error } = await supabase.from('training_plans').update(patch).eq('user_id', userId);
  if (error) throw error;
}

/** Same as updateCrewPlan, but scoped by plan id instead of owner user id
 * — for an accepted crew member editing a plan that isn't their own. RLS
 * ("crew members can edit shared plans") is what actually enforces they
 * only succeed on plans they've been granted access to. */
export async function updateCrewPlanById(
  planId: string,
  updates: {
    raceDate?: string;
    raceStartTime?: string | null;
    goalFinishMinutes?: number | null;
    crewNotes?: Record<string, CrewNoteEntry>;
    courseSegments?: CourseSegment[] | null;
    gpxRoute?: GpxRoute | null;
  },
) {
  const patch: Record<string, unknown> = {};
  if ('raceDate' in updates && updates.raceDate) patch.race_date = updates.raceDate;
  if ('raceStartTime' in updates) patch.race_start_time = updates.raceStartTime ?? null;
  if ('goalFinishMinutes' in updates) patch.goal_finish_minutes = updates.goalFinishMinutes ?? null;
  if ('crewNotes' in updates) patch.crew_notes = updates.crewNotes ?? {};
  if ('courseSegments' in updates) patch.course_segments = updates.courseSegments ?? null;
  if ('gpxRoute' in updates) patch.gpx_route = updates.gpxRoute ?? null;

  const { error } = await supabase.from('training_plans').update(patch).eq('id', planId);
  if (error) throw error;
}

// ─── Crew Plan — course segment images ───────────────────────────────────
// Elevation-profile images for a plan's course segments live in the
// private `course-segments` Storage bucket, keyed <planId>/<uuid>.<ext>.
// A CourseSegment's `profileImage` stores that object path prefixed
// `storage:`. Bundled BigFoot images use a plain asset URL and skip all
// of this. Bucket RLS (supabase/schema.sql): any accepted crew reads,
// owner / Chief Crew writes.

export const COURSE_SEGMENT_STORAGE_PREFIX = 'storage:';
const COURSE_SEGMENTS_BUCKET = 'course-segments';

/** Resolves a segment's `profileImage` to a value usable as an <img src>.
 * A `storage:`-prefixed path is a private bucket object and gets a
 * time-limited signed URL; anything else (a bundled asset URL) is
 * returned unchanged. Null if signing fails. */
export async function resolveCourseSegmentImage(profileImage: string): Promise<string | null> {
  if (!profileImage.startsWith(COURSE_SEGMENT_STORAGE_PREFIX)) return profileImage;
  const path = profileImage.slice(COURSE_SEGMENT_STORAGE_PREFIX.length);
  const { data, error } = await supabase.storage.from(COURSE_SEGMENTS_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/** Uploads one elevation-profile image for a plan's course segment and
 * returns the value to store in `CourseSegment.profileImage` (a
 * `storage:`-prefixed object path). Throws if the bucket RLS rejects the
 * write (caller isn't the plan owner or Chief Crew) or the upload fails. */
export async function uploadCourseSegmentImage(planId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${planId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(COURSE_SEGMENTS_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return `${COURSE_SEGMENT_STORAGE_PREFIX}${path}`;
}

/** Best-effort delete of a previously uploaded segment image. No-op for a
 * non-storage value (bundled asset). Never throws — a leftover object is
 * harmless and cleanup shouldn't fail the edit that triggered it. */
export async function deleteCourseSegmentImage(profileImage: string): Promise<void> {
  if (!profileImage.startsWith(COURSE_SEGMENT_STORAGE_PREFIX)) return;
  const path = profileImage.slice(COURSE_SEGMENT_STORAGE_PREFIX.length);
  await supabase.storage.from(COURSE_SEGMENTS_BUCKET).remove([path]).then(
    () => {},
    () => {},
  );
}

// ─── Crew Plan collaboration ─────────────────────────────────────────────

/** Invites someone (by email) to collaborate on a plan's Crew Plan screen.
 * Creates a 'pending' row — it becomes 'accepted' automatically the next
 * time anyone signs in with that email (see claimPendingInvites). There's
 * no email sent by the app itself — the person needs to know to sign up
 * or sign in with that exact address. */
export async function inviteCrewMember(ownerUserId: string, planId: string, email: string, makeChief: boolean = false) {
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase
    .from('crew_plan_access')
    .upsert(
      { plan_id: planId, owner_user_id: ownerUserId, invited_email: normalizedEmail },
      { onConflict: 'plan_id,invited_email', ignoreDuplicates: true },
    );
  if (error) throw error;

  if (makeChief) {
    // ignoreDuplicates means the upsert above silently did nothing if
    // this email was already invited — fetch the row's id either way and
    // promote it explicitly, rather than trying to fold role-setting
    // into the upsert itself.
    const { data: row, error: fetchErr } = await supabase
      .from('crew_plan_access')
      .select('id')
      .eq('plan_id', planId)
      .eq('invited_email', normalizedEmail)
      .single();
    if (fetchErr) throw fetchErr;
    await promoteToChief(planId, row.id);
  }
}

/** Promotes one crew member to Chief Crew, demoting whoever currently
 * holds it first — the database's partial unique index (one chief per
 * plan) would reject inserting/updating a second one, so the existing
 * chief has to step down before the new one can step up, not after. */
export async function promoteToChief(planId: string, accessId: string) {
  const { error: demoteErr } = await supabase.from('crew_plan_access').update({ role: 'crew' }).eq('plan_id', planId).eq('role', 'chief');
  if (demoteErr) throw demoteErr;

  const { error: promoteErr } = await supabase.from('crew_plan_access').update({ role: 'chief' }).eq('id', accessId);
  if (promoteErr) throw promoteErr;
}

export async function fetchCrewAccessList(planId: string): Promise<CrewAccessEntry[]> {
  const { data, error } = await supabase
    .from('crew_plan_access')
    .select('id, invited_email, status, role')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, invitedEmail: r.invited_email, status: r.status, role: r.role ?? 'crew' }));
}

// ─── Crew Plan check-in/check-out ────────────────────────────────────────
// A lightweight soft-lock so two people (owner + crew, or two crew
// members) don't silently overwrite each other while both have the Crew
// Plan screen open. Polling-based rather than a real-time websocket
// connection — deliberately simpler and more robust for this scale (a
// handful of crew, not hundreds of concurrent editors): no channel
// lifecycle to manage, and a dropped connection or backgrounded phone
// can't leave anyone in an inconsistent state, it just misses a poll.

export const CREW_PLAN_LOCK_TIMEOUT_MS = 3 * 60 * 1000; // no heartbeat for 3 minutes = treat as abandoned

export interface CrewPlanLockState {
  userId: string | null;
  name: string | null;
  startedAt: string | null;
}

export function isCrewPlanLockActive(lock: CrewPlanLockState): boolean {
  if (!lock.userId || !lock.startedAt) return false;
  return Date.now() - new Date(lock.startedAt).getTime() < CREW_PLAN_LOCK_TIMEOUT_MS;
}

export async function fetchCrewPlanLock(planId: string): Promise<CrewPlanLockState> {
  const { data, error } = await supabase
    .from('training_plans')
    .select('active_editor_user_id, active_editor_name, active_editor_started_at')
    .eq('id', planId)
    .single();
  if (error) throw error;
  return { userId: data.active_editor_user_id, name: data.active_editor_name, startedAt: data.active_editor_started_at };
}

/** Attempts to claim the editing lock. Succeeds if nobody else holds an
 * active one, or if this same user already does (re-entering the page).
 * Otherwise returns claimed: false with who currently has it, so the
 * caller can show a read-only view instead. Fetch-then-update rather than
 * a single atomic operation — a genuine simultaneous double-claim is
 * possible in principle, but vanishingly unlikely at this scale (a
 * handful of people, not a high-concurrency system) and not worth the
 * complexity of a database function for this. */
export async function claimCrewPlanLock(planId: string, userId: string, name: string): Promise<{ claimed: boolean; heldBy: CrewPlanLockState }> {
  const current = await fetchCrewPlanLock(planId);
  if (isCrewPlanLockActive(current) && current.userId !== userId) {
    return { claimed: false, heldBy: current };
  }
  const startedAt = new Date().toISOString();
  const { error } = await supabase
    .from('training_plans')
    .update({ active_editor_user_id: userId, active_editor_name: name, active_editor_started_at: startedAt })
    .eq('id', planId);
  if (error) throw error;
  return { claimed: true, heldBy: { userId, name, startedAt } };
}

/** Keeps an already-claimed lock fresh — call periodically while the
 * holder still has the page open, or it'll expire and let someone else
 * claim it out from under them. */
export async function heartbeatCrewPlanLock(planId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('training_plans')
    .update({ active_editor_started_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('active_editor_user_id', userId);
  if (error) throw error;
}

/** Releases the lock — only succeeds if this user is the one currently
 * holding it, so a stale/delayed release call can't clear someone else's
 * active session. */
export async function releaseCrewPlanLock(planId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('training_plans')
    .update({ active_editor_user_id: null, active_editor_name: null, active_editor_started_at: null })
    .eq('id', planId)
    .eq('active_editor_user_id', userId);
  if (error) throw error;
}

/** A crew member's own role for a shared plan — used to decide whether
 * to show the Upload/Replace GPX control at all in shared mode. This is
 * a UI convenience only; the actual restriction is enforced server-side
 * by the enforce_gpx_route_chief_only trigger regardless of what this
 * returns. */
export async function fetchMyCrewRole(planId: string, userId: string): Promise<'crew' | 'chief' | null> {
  const { data, error } = await supabase
    .from('crew_plan_access')
    .select('role')
    .eq('plan_id', planId)
    .eq('crew_user_id', userId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

export async function removeCrewAccess(accessId: string) {
  const { error } = await supabase.from('crew_plan_access').delete().eq('id', accessId);
  if (error) throw error;
}

/** Called on every sign-in (see AppContext). Claims any pending invite(s)
 * addressed to this user's email by attaching their user id and flipping
 * status to 'accepted' — that's what actually activates the RLS policies
 * granting them access to the plan. A no-op if there are none, so it's
 * safe to call unconditionally every time. */
export async function claimPendingInvites(userId: string, email: string) {
  if (!email) return;
  const { error } = await supabase
    .from('crew_plan_access')
    .update({ crew_user_id: userId, status: 'accepted' })
    .eq('invited_email', email.trim().toLowerCase())
    .eq('status', 'pending');
  if (error) throw error;
}

/** All plans (accepted invites only) shared with this user as crew —
 * someone could conceivably be crewing for more than one runner. */
export async function fetchSharedPlans(userId: string): Promise<{ accessId: string; ownerUserId: string; plan: TrainingPlan }[]> {
  const { data: accessRows, error: accessErr } = await supabase
    .from('crew_plan_access')
    .select('id, plan_id, owner_user_id')
    .eq('crew_user_id', userId)
    .eq('status', 'accepted');
  if (accessErr) throw accessErr;
  if (!accessRows || accessRows.length === 0) return [];

  const results = await Promise.all(
    accessRows.map(async (row) => {
      const fetched = await fetchTrainingPlanById(row.plan_id);
      if (!fetched) return null;
      return { accessId: row.id, ownerUserId: row.owner_user_id, plan: fetched.plan };
    }),
  );
  return results.filter((r): r is { accessId: string; ownerUserId: string; plan: TrainingPlan } => r !== null);
}

// ─── Logged runs ─────────────────────────────────────────────────────────

function mapRunRow(r: any): LoggedRun {
  const totalSeconds = r.duration_seconds;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const tempDigits = typeof r.temperature_label === 'string' ? r.temperature_label.match(/-?\d+/)?.[0] : undefined;
  return {
    id: r.id,
    date: r.run_date,
    distance: String(r.distance_miles),
    duration: formatDurationParts(days, hours, minutes, seconds),
    timeOfDay: r.time_of_day ?? '',
    paceLabel: r.pace_label ?? '—',
    temperature: r.temperature_label ?? '—',
    electrolytes: r.electrolytes_count > 0 && r.electrolytes_brand ? `${r.electrolytes_count}x ${r.electrolytes_brand}` : '—',
    nutrition: r.nutrition_count > 0 && r.nutrition_brand ? `${r.nutrition_count}x ${r.nutrition_brand}` : '—',
    comment: r.comment ?? '',
    routePoints: r.route_points ?? undefined,
    activityName: r.activity_name ?? undefined,
    activityType: r.activity_type ?? undefined,
    avgHeartRate: r.avg_heart_rate ?? undefined,
    maxHeartRate: r.max_heart_rate ?? undefined,
    minHeartRate: r.min_heart_rate ?? undefined,
    avgCadence: r.avg_cadence ?? undefined,
    maxCadence: r.max_cadence ?? undefined,
    elevationGainFt: r.elevation_gain_ft ?? undefined,
    elevationLossFt: r.elevation_loss_ft ?? undefined,
    // Raw, editable-form-shaped values — the fields above are all
    // display-formatted (e.g. duration as "1h 16m 25s"), which isn't safe
    // to parse back apart for repopulating the Log a Run form when
    // editing. These are the same values before formatting.
    raw: {
      distanceMiles: Number(r.distance_miles),
      days,
      hours,
      minutes,
      seconds,
      timeOfDay: r.time_of_day ?? '',
      temperature: tempDigits ?? '',
      electrolytesCount: r.electrolytes_count ?? 0,
      electrolytesBrand: r.electrolytes_brand ?? '',
      nutritionCount: r.nutrition_count ?? 0,
      nutritionBrand: r.nutrition_brand ?? '',
      comment: r.comment ?? '',
    },
  };
}

export async function fetchLoggedRuns(userId: string): Promise<LoggedRun[]> {
  const { data, error } = await supabase
    .from('logged_runs')
    .select('*')
    .eq('user_id', userId)
    .order('run_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRunRow);
}

export interface NewRunInput {
  date: string;
  distanceMiles: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  timeOfDay: string;
  paceLabel: string;
  temperatureLabel: string;
  electrolytesCount: number;
  electrolytesBrand: string;
  nutritionCount: number;
  nutritionBrand: string;
  comment: string;
  routePoints?: { lat: number; lon: number }[]; // only set for GPX-imported runs
  activityName?: string;
  activityType?: string;
  avgHeartRate?: number;
  maxHeartRate?: number;
  minHeartRate?: number;
  avgCadence?: number;
  maxCadence?: number;
  elevationGainFt?: number;
  elevationLossFt?: number;
}

function runInputToRow(run: NewRunInput) {
  const totalSeconds = run.days * 86400 + run.hours * 3600 + run.minutes * 60 + run.seconds;
  return {
    run_date: run.date,
    distance_miles: run.distanceMiles,
    duration_seconds: totalSeconds,
    time_of_day: run.timeOfDay,
    pace_label: run.paceLabel,
    temperature_label: run.temperatureLabel,
    electrolytes_count: run.electrolytesCount,
    electrolytes_brand: run.electrolytesBrand,
    nutrition_count: run.nutritionCount,
    nutrition_brand: run.nutritionBrand,
    comment: run.comment,
  };
}

export async function insertLoggedRun(userId: string, run: NewRunInput): Promise<LoggedRun> {
  const { data, error } = await supabase
    .from('logged_runs')
    .insert({
      user_id: userId,
      ...runInputToRow(run),
      route_points: run.routePoints ?? null,
      activity_name: run.activityName ?? null,
      activity_type: run.activityType ?? null,
      avg_heart_rate: run.avgHeartRate ?? null,
      max_heart_rate: run.maxHeartRate ?? null,
      min_heart_rate: run.minHeartRate ?? null,
      avg_cadence: run.avgCadence ?? null,
      max_cadence: run.maxCadence ?? null,
      elevation_gain_ft: run.elevationGainFt ?? null,
      elevation_loss_ft: run.elevationLossFt ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRunRow(data);
}

/** Updates an existing logged run. `preserveGpxMetadata` should be true
 * unless the person re-uploaded a fresh GPX during this edit — otherwise
 * an edit of a GPX-imported run's manual fields (say, fixing a typo in
 * comments) would silently wipe out its heart rate/cadence/route data by
 * writing nulls over it. */
export async function updateLoggedRun(runId: string, run: NewRunInput, preserveGpxMetadata: boolean): Promise<LoggedRun> {
  const patch: Record<string, unknown> = runInputToRow(run);
  if (!preserveGpxMetadata) {
    patch.route_points = run.routePoints ?? null;
    patch.activity_name = run.activityName ?? null;
    patch.activity_type = run.activityType ?? null;
    patch.avg_heart_rate = run.avgHeartRate ?? null;
    patch.max_heart_rate = run.maxHeartRate ?? null;
    patch.min_heart_rate = run.minHeartRate ?? null;
    patch.avg_cadence = run.avgCadence ?? null;
    patch.max_cadence = run.maxCadence ?? null;
    patch.elevation_gain_ft = run.elevationGainFt ?? null;
    patch.elevation_loss_ft = run.elevationLossFt ?? null;
  }
  const { data, error } = await supabase.from('logged_runs').update(patch).eq('id', runId).select().single();
  if (error) throw error;
  return mapRunRow(data);
}

export async function deleteLoggedRun(runId: string): Promise<void> {
  const { error } = await supabase.from('logged_runs').delete().eq('id', runId);
  if (error) throw error;
}

export async function updateLoggedRunTemperature(runId: string, label: string) {
  const { error } = await supabase.from('logged_runs').update({ temperature_label: label }).eq('id', runId);
  if (error) throw error;
}

// re-exported for convenience where callers need duration math without a
// round-trip to the DB (e.g. computing pace client-side before insert)
export { durationToSeconds };
