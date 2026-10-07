import type { DistanceGoal } from '../types';
import { formatClockTime, parsePaceMinutes, raceSecondsAtPace } from './format';

const MILE_M = 1609.344;
const KM_TO_MILE = 1.609344;

const RACE_METERS: Partial<Record<DistanceGoal, number>> = { '5k': 5000, '10k': 10000, half: 21097.5, full: 42195 };

/** Paces in seconds per mile. `easyFast`/`easySlow` bound the easy range. */
export interface TrainingPaces {
  easyFast: number;
  easySlow: number;
  steady: number;
  tempo: number;
  interval: number;
  race: number;
}

// Jack Daniels / Jim Gilbert VDOT model: a race time -> a fitness score
// (VDOT), then training paces at set fractions of that score's VO2.
function vdotFromRace(distanceM: number, seconds: number): number {
  const t = seconds / 60;
  const v = distanceM / t;
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const fractionOfMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / fractionOfMax;
}

function secondsPerMileAtVo2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  const v = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a); // meters/min
  return (MILE_M / v) * 60;
}

/** Training paces for a goal finish time at a standard road distance.
 * Null for ultras, a missing goal, or a time too extreme to be real. */
export function trainingPacesFor(distanceGoal: DistanceGoal, goalMinutes: number | null | undefined): TrainingPaces | null {
  const meters = RACE_METERS[distanceGoal];
  if (!meters || !goalMinutes || goalMinutes <= 0) return null;
  const seconds = goalMinutes * 60;
  const vdot = vdotFromRace(meters, seconds);
  if (!(vdot >= 20 && vdot <= 85)) return null;
  const at = (fraction: number) => secondsPerMileAtVo2(fraction * vdot);
  return {
    easySlow: at(0.65),
    easyFast: at(0.74),
    steady: at(0.8),
    tempo: at(0.88),
    interval: at(0.98),
    race: seconds / (meters / MILE_M),
  };
}

export type PaceUnit = 'mi' | 'km';

export function formatPace(secondsPerMile: number, unit: PaceUnit): string {
  const s = unit === 'km' ? secondsPerMile / KM_TO_MILE : secondsPerMile;
  return `${formatClockTime(s)}/${unit}`;
}

export function formatEasyRange(p: TrainingPaces, unit: PaceUnit): string {
  const per = (s: number) => formatPace(s, unit).replace(`/${unit}`, '');
  return `${per(p.easyFast)}–${per(p.easySlow)}/${unit}`;
}

export type WorkoutKind = 'rest' | 'easy' | 'steady' | 'tempo' | 'intervals' | 'long' | 'shake' | 'race' | 'other';

const WED = 2;
const SAT = 5;

/** What a standard-distance plan cell is. Plans saved before Wednesdays
 * were labeled have a bare "3 mi" on Wed (steady) and Sat (the long run;
 * the race itself in race week), so those two days infer their kind. */
export function workoutKind(dayIndex: number, text: string, isRaceWeek: boolean): WorkoutKind {
  const t = text.toLowerCase();
  if (t === 'rest') return 'rest';
  if (t.includes('interval')) return 'intervals';
  if (t.includes('tempo')) return 'tempo';
  if (t.includes('steady')) return 'steady';
  if (t.includes('shake')) return 'shake';
  if (t.includes('easy')) return 'easy';
  if (dayIndex === SAT) return isRaceWeek ? 'race' : 'long';
  if (dayIndex === WED) return 'steady';
  return 'other';
}

/** Cell text to display — adds the "(Steady)" label to Wednesdays saved
 * without one. */
export function displayWorkoutText(dayIndex: number, text: string, kind: WorkoutKind): string {
  if (dayIndex === WED && kind === 'steady' && !text.includes('(')) return `${text} (Steady)`;
  return text;
}

function milesIn(text: string): number | null {
  const m = text.match(/([\d.]+)\s*mi/i);
  return m ? Number(m[1]) : null;
}

function fmtMiles(x: number): string {
  const r = Math.round(x * 2) / 2;
  return `${r} mi`;
}

// Rep distance (m) and recovery jog (m) by race distance and phase. Early
// base work stays short; build phase moves to longer reps; longer races use
// longer reps throughout.
function repSpec(distanceGoal: DistanceGoal, phase: string): { repM: number; jogM: number } {
  const build = phase === 'Build Phase';
  const gentle = phase === 'Recovery Week' || phase === 'Taper Phase' || phase === 'Race Week';
  if (distanceGoal === '5k' || distanceGoal === '10k') {
    return build ? { repM: 800, jogM: 400 } : { repM: 400, jogM: 200 };
  }
  if (gentle) return { repM: 400, jogM: 200 };
  if (distanceGoal === 'half') return build ? { repM: 1000, jogM: 400 } : { repM: 800, jogM: 400 };
  return build ? { repM: 1200, jogM: 400 } : { repM: 800, jogM: 400 };
}

/** The pace guidance shown under a workout, or null when there's none. */
export function workoutDetail(
  kind: WorkoutKind,
  text: string,
  ctx: { distanceGoal: DistanceGoal; phase: string; paces: TrainingPaces; unit: PaceUnit },
): string | null {
  const { distanceGoal, phase, paces, unit } = ctx;
  switch (kind) {
    case 'easy':
      return `${formatEasyRange(paces, unit)} · conversational`;
    case 'shake':
      return `${formatEasyRange(paces, unit)} · very easy`;
    case 'long':
      return `${formatEasyRange(paces, unit)} · easy, conversational`;
    case 'steady':
      return `${formatPace(paces.steady, unit)} · comfortably hard`;
    case 'race':
      return `Goal pace ${formatPace(paces.race, unit)}`;
    case 'tempo': {
      const total = milesIn(text);
      if (total == null) return `${formatPace(paces.tempo, unit)} · comfortably hard`;
      const work = Math.max(1, total - (total >= 4 ? 2 : total >= 3 ? 1.5 : 1));
      return `${fmtMiles(work)} @ ${formatPace(paces.tempo, unit)} · easy warm-up & cool-down`;
    }
    case 'intervals': {
      const total = milesIn(text);
      if (total == null) return `Reps @ ${formatPace(paces.interval, unit)}`;
      const work = Math.max(0.5, total - (total >= 4 ? 2 : total >= 3 ? 1.5 : 1));
      let { repM, jogM } = repSpec(distanceGoal, phase);
      let reps = Math.floor((work * MILE_M) / (repM + jogM));
      if (reps < 3) {
        repM = 400;
        jogM = 200;
        reps = Math.floor((work * MILE_M) / (repM + jogM));
      }
      reps = Math.min(10, Math.max(3, reps));
      const perUnitM = unit === 'km' ? 1000 : MILE_M;
      const repSeconds = ((unit === 'km' ? paces.interval / KM_TO_MILE : paces.interval) * repM) / perUnitM;
      return `${reps} × ${repM} m @ ${formatPace(paces.interval, unit)} (${formatClockTime(repSeconds)} per rep) · ${jogM} m jog between · easy warm-up & cool-down`;
    }
    default:
      return null;
  }
}

/** Set when the goal is more than ~8% faster than the time the pace entered
 * during onboarding would produce over the race distance — a soft "your goal
 * is well ahead of where you are now" nudge. Only possible when the runner
 * typed their own pace (the Easy/Steady/Fast bands are ranges). */
export function goalAheadOfCurrentPace(plan: {
  distanceGoal: DistanceGoal;
  goalFinishMinutes: number | null;
  pace?: string | null;
  paceUnit?: string | null;
  customPace?: string | null;
}): { currentSeconds: number; goalSeconds: number } | null {
  if (plan.pace !== 'custom' || !plan.customPace || !plan.goalFinishMinutes) return null;
  const paceMinutes = parsePaceMinutes(plan.customPace);
  if (paceMinutes == null) return null;
  const currentSeconds = raceSecondsAtPace(plan.distanceGoal, paceMinutes, plan.paceUnit === 'km' ? 'km' : 'mi');
  if (currentSeconds == null) return null;
  const goalSeconds = plan.goalFinishMinutes * 60;
  return goalSeconds < currentSeconds * 0.92 ? { currentSeconds, goalSeconds } : null;
}
