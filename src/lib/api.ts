import { supabase } from './supabaseClient';
import type { Address, CrewAccessEntry, CrewNoteEntry, GpxRoute, LoggedRun, TrainingPlan } from '../types';
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

  const [profile, trainingPlan, loggedRuns, sharedPlans] = await Promise.all([
    fetchProfile(userId),
    fetchTrainingPlan(userId),
    fetchLoggedRuns(userId),
    fetchSharedPlans(userId),
  ]);
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
    loggedRuns,
    sharedPlans,
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

export async function saveTrainingPlan(userId: string, plan: TrainingPlan) {
  const { data: planRow, error: planErr } = await supabase
    .from('training_plans')
    .upsert(
      {
        user_id: userId,
        race_name: plan.raceName,
        distance_goal: plan.distanceGoal,
        first_time: plan.firstTime,
        hill_access: plan.hillAccess || null,
        gpx_route: plan.gpxRoute ?? null,
        race_date: plan.raceDate,
        race_start_time: plan.raceStartTime ?? null,
        goal_finish_minutes: plan.goalFinishMinutes ?? null,
        crew_notes: plan.crewNotes ?? {},
        total_weeks: plan.totalWeeks,
        quote: plan.quote,
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();
  if (planErr) throw planErr;

  // Replace any existing week rows for this plan (simplest correct approach
  // since the plan is only ever generated once, never edited week-by-week).
  await supabase.from('training_plan_weeks').delete().eq('plan_id', planRow.id);

  const weekRows = plan.rows.map((r) => ({
    plan_id: planRow.id,
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

  return planRow;
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
    raceName: planRow.race_name,
    distanceGoal: planRow.distance_goal,
    firstTime: planRow.first_time,
    hillAccess: planRow.hill_access ?? '',
    gpxRoute: planRow.gpx_route ?? null,
    raceDate: planRow.race_date,
    raceStartTime: planRow.race_start_time ?? null,
    goalFinishMinutes: planRow.goal_finish_minutes ?? null,
    crewNotes: planRow.crew_notes ?? {},
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

export async function fetchTrainingPlan(userId: string): Promise<TrainingPlan | null> {
  const { data: planRow, error: planErr } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (planErr) throw planErr;
  if (!planRow) return null;
  return mapPlanRow(planRow);
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
    gpxRoute?: GpxRoute | null;
  },
) {
  const patch: Record<string, unknown> = {};
  if ('raceDate' in updates && updates.raceDate) patch.race_date = updates.raceDate;
  if ('raceStartTime' in updates) patch.race_start_time = updates.raceStartTime ?? null;
  if ('goalFinishMinutes' in updates) patch.goal_finish_minutes = updates.goalFinishMinutes ?? null;
  if ('crewNotes' in updates) patch.crew_notes = updates.crewNotes ?? {};
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
    gpxRoute?: GpxRoute | null;
  },
) {
  const patch: Record<string, unknown> = {};
  if ('raceDate' in updates && updates.raceDate) patch.race_date = updates.raceDate;
  if ('raceStartTime' in updates) patch.race_start_time = updates.raceStartTime ?? null;
  if ('goalFinishMinutes' in updates) patch.goal_finish_minutes = updates.goalFinishMinutes ?? null;
  if ('crewNotes' in updates) patch.crew_notes = updates.crewNotes ?? {};
  if ('gpxRoute' in updates) patch.gpx_route = updates.gpxRoute ?? null;

  const { error } = await supabase.from('training_plans').update(patch).eq('id', planId);
  if (error) throw error;
}

// ─── Crew Plan collaboration ─────────────────────────────────────────────

/** Invites someone (by email) to collaborate on a plan's Crew Plan screen.
 * Creates a 'pending' row — it becomes 'accepted' automatically the next
 * time anyone signs in with that email (see claimPendingInvites). There's
 * no email sent by the app itself — the person needs to know to sign up
 * or sign in with that exact address. */
export async function inviteCrewMember(ownerUserId: string, planId: string, email: string) {
  const { error } = await supabase
    .from('crew_plan_access')
    .upsert(
      { plan_id: planId, owner_user_id: ownerUserId, invited_email: email.trim().toLowerCase() },
      { onConflict: 'plan_id,invited_email', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function fetchCrewAccessList(planId: string): Promise<CrewAccessEntry[]> {
  const { data, error } = await supabase
    .from('crew_plan_access')
    .select('id, invited_email, status')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, invitedEmail: r.invited_email, status: r.status }));
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
