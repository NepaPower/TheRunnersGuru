import { supabase } from './supabaseClient';
import type { Address, LoggedRun, TrainingPlan } from '../types';
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
 * or the dashboard without racing the auth-state-change listener). */
export async function hydrateUserData(userId: string) {
  const [profile, trainingPlan, loggedRuns] = await Promise.all([
    fetchProfile(userId),
    fetchTrainingPlan(userId),
    fetchLoggedRuns(userId),
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
        race_date: plan.raceDate,
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
    is_race_week: r.isRaceWeek,
  }));
  const { error: weeksErr } = await supabase.from('training_plan_weeks').insert(weekRows);
  if (weeksErr) throw weeksErr;

  return planRow;
}

export async function fetchTrainingPlan(userId: string): Promise<TrainingPlan | null> {
  const { data: planRow, error: planErr } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (planErr) throw planErr;
  if (!planRow) return null;

  const { data: weekRows, error: weeksErr } = await supabase
    .from('training_plan_weeks')
    .select('*')
    .eq('plan_id', planRow.id)
    .order('week_number', { ascending: true });
  if (weeksErr) throw weeksErr;

  return {
    raceName: planRow.race_name,
    distanceGoal: planRow.distance_goal,
    firstTime: planRow.first_time,
    hillAccess: planRow.hill_access ?? '',
    raceDate: planRow.race_date,
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
      isRaceWeek: w.is_race_week,
    })),
  };
}

// ─── Logged runs ─────────────────────────────────────────────────────────

export async function fetchLoggedRuns(userId: string): Promise<LoggedRun[]> {
  const { data, error } = await supabase
    .from('logged_runs')
    .select('*')
    .eq('user_id', userId)
    .order('run_date', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => {
    const totalSeconds = r.duration_seconds;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
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
    };
  });
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
}

export async function insertLoggedRun(userId: string, run: NewRunInput): Promise<LoggedRun> {
  const totalSeconds = run.days * 86400 + run.hours * 3600 + run.minutes * 60 + run.seconds;
  const { data, error } = await supabase
    .from('logged_runs')
    .insert({
      user_id: userId,
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
    })
    .select()
    .single();
  if (error) throw error;

  return {
    id: data.id,
    date: data.run_date,
    distance: String(data.distance_miles),
    duration: formatDurationParts(run.days, run.hours, run.minutes, run.seconds),
    timeOfDay: data.time_of_day ?? '',
    paceLabel: data.pace_label ?? '—',
    temperature: data.temperature_label ?? '—',
    electrolytes: run.electrolytesCount > 0 && run.electrolytesBrand ? `${run.electrolytesCount}x ${run.electrolytesBrand}` : '—',
    nutrition: run.nutritionCount > 0 && run.nutritionBrand ? `${run.nutritionCount}x ${run.nutritionBrand}` : '—',
    comment: data.comment ?? '',
  };
}

export async function updateLoggedRunTemperature(runId: string, label: string) {
  const { error } = await supabase.from('logged_runs').update({ temperature_label: label }).eq('id', runId);
  if (error) throw error;
}

// re-exported for convenience where callers need duration math without a
// round-trip to the DB (e.g. computing pace client-side before insert)
export { durationToSeconds };
