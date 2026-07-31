import type { DistanceGoal, FirstTimeAnswer, HillAccessAnswer, PhaseSummaryItem, TrainingPlan, TrainingPlanRow } from '../types';
import { DISTANCE_LABELS, RUNNING_QUOTES } from '../data/constants';

/**
 * Ported from the user-supplied Python function `generate_dynamic_marathon_plan`
 * (via the prototype's JS port, `generateDynamicPlan`). Keep the phase logic
 * and mileage formulas exactly as-is if you touch this file — the numbers
 * here are the product's actual training methodology, not placeholder values.
 */

interface PlanTargets {
  startLong: number;
  peakLong: number;
  startWeekly: number;
  peakWeekly: number;
  raceMiles: number;
}

const PLAN_TARGETS: Record<DistanceGoal, PlanTargets> = {
  '5k': { startLong: 3, peakLong: 6, startWeekly: 10, peakWeekly: 20, raceMiles: 3.1 },
  '10k': { startLong: 4, peakLong: 8, startWeekly: 12, peakWeekly: 25, raceMiles: 6.2 },
  half: { startLong: 5, peakLong: 12, startWeekly: 15, peakWeekly: 32, raceMiles: 13.1 },
  full: { startLong: 6, peakLong: 20, startWeekly: 16, peakWeekly: 45, raceMiles: 26.2 },
  ultra: { startLong: 8, peakLong: 26, startWeekly: 20, peakWeekly: 60, raceMiles: 31 },
};

interface RawPlanRow {
  week: number;
  phase: TrainingPlanRow['phase'];
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
  totalMiles: number;
  totalHours?: number;
}

/** Phase 1..4 summary, scaled to plan length (used in the Training Plan
 * screen's "Phase Summary" panel — independent of the week-by-week table). */
export function buildPhaseSummary(totalWeeks: number): PhaseSummaryItem[] {
  if (!totalWeeks) return [];
  const taperLen = totalWeeks >= 10 ? 3 : totalWeeks >= 5 ? 2 : 1;
  const p3Len = Math.min(taperLen, Math.max(1, totalWeeks - taperLen));
  const remaining = Math.max(0, totalWeeks - taperLen - p3Len);
  const p1Len = Math.max(1, Math.ceil(remaining / 2));
  const p2Len = Math.max(0, remaining - p1Len);

  let w = 1;
  const phases: { range: string; title: string }[] = [];
  const push = (len: number, title: string) => {
    if (len <= 0) return;
    const from = w;
    const to = w + len - 1;
    phases.push({ range: 'Weeks ' + from + (to > from ? '–' + to : ''), title });
    w += len;
  };
  push(p1Len, 'Aerobic Foundation & Endurance Base');
  push(p2Len, 'Threshold, Strength & Mid-Distance Progression');
  push(p3Len, 'Peak Volume & Long Runs');
  push(taperLen, 'Taper & Race Day Preparation');

  return phases.map((p, i) => ({ label: 'Phase ' + (i + 1) + ' (' + p.range + ')', title: p.title }));
}

/** Generates one row per week: phase, daily mileage breakdown, weekly total.
 * Long run and weekly total scale linearly from start -> peak across the
 * build phase; recovery weeks (every 4th week) cut ~30%; taper steps down
 * in stages; race week is a short shakeout + the race distance on race day. */
function generateDynamicPlan(
  totalWeeks: number,
  distanceGoal: DistanceGoal,
  firstTime: FirstTimeAnswer,
  raceMilesOverride?: number | null,
): RawPlanRow[] {
  const cfg = PLAN_TARGETS[distanceGoal] || PLAN_TARGETS['5k'];
  const factor = firstTime === 'yes' ? 0.85 : 1;
  const startLongRun = cfg.startLong;
  const peakLongRun = cfg.peakLong * factor;
  const startWeeklyMiles = cfg.startWeekly;
  const peakWeeklyMiles = cfg.peakWeekly * factor;
  // For ultra, the specific selected distance (50K up to a custom 500-mile
  // entry) overrides the generic 31-mile default so Race Week shows the
  // real race-day mileage. The weekly build-up (peakLongRun/peakWeeklyMiles
  // above) still uses the generic ultra targets regardless of which ultra
  // distance was picked — scaling those to the actual distance is part of
  // the larger time+vert based ultra generator, not yet built.
  const raceMiles = raceMilesOverride ?? cfg.raceMiles;

  const taperWeeks = totalWeeks >= 10 ? 3 : totalWeeks >= 5 ? 2 : 1;
  const buildWeeks = totalWeeks - taperWeeks;

  const rows: RawPlanRow[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    let phase: TrainingPlanRow['phase'];
    if (week === totalWeeks) phase = 'Race Week';
    else if (week > totalWeeks - taperWeeks) phase = 'Taper Phase';
    else if (week % 4 === 0 && week < buildWeeks) phase = 'Recovery Week';
    else if (week <= Math.max(4, Math.floor(totalWeeks / 4))) phase = 'Base Building';
    else phase = 'Build Phase';

    let longRun: number;
    let totalMiles: number;
    const linearRatio = buildWeeks > 1 ? Math.min(1, (week - 1) / (buildWeeks - 1)) : 1;

    if (phase === 'Taper Phase') {
      const taperStep = totalWeeks - week;
      longRun = 8 + taperStep * 4;
      totalMiles = 22 + taperStep * 7;
    } else if (phase === 'Race Week') {
      longRun = raceMiles;
      totalMiles = raceMiles + 9;
    } else if (phase === 'Recovery Week') {
      longRun = Math.round((startLongRun + linearRatio * (peakLongRun - startLongRun)) * 0.65);
      totalMiles = Math.round((startWeeklyMiles + linearRatio * (peakWeeklyMiles - startWeeklyMiles)) * 0.7);
    } else {
      longRun = Math.round(startLongRun + linearRatio * (peakLongRun - startLongRun));
      totalMiles = Math.round(startWeeklyMiles + linearRatio * (peakWeeklyMiles - startWeeklyMiles));
    }

    let mon: string, tue: string, wed: string, thu: string, fri: string, sat: string, sun: string;
    if (phase === 'Race Week') {
      mon = 'Rest';
      tue = '4 mi (Easy)';
      wed = '3 mi';
      thu = 'Rest';
      fri = '2 mi (Shake)';
      sat = raceMiles.toFixed(1) + ' mi';
      sun = 'Rest';
    } else {
      const remMiles = totalMiles - longRun;
      const tueMiles = Math.round(remMiles * 0.3);
      const wedMiles = Math.round(remMiles * 0.35);
      const thuMiles = Math.round(remMiles * 0.35);
      const tueStyle = week % 2 === 0 ? 'Intervals' : phase === 'Base Building' ? 'Easy' : 'Tempo';
      mon = 'Rest';
      tue = tueMiles + ' mi (' + tueStyle + ')';
      wed = wedMiles + ' mi';
      thu = thuMiles + ' mi (Easy)';
      fri = 'Rest';
      sat = Math.round(longRun) + ' mi';
      sun = 'Rest';
    }
    rows.push({ week, phase, mon, tue, wed, thu, fri, sat, sun, totalMiles });
  }
  return rows;
}

/** Phase-scoped session helpers for the ultra generator below. Each pairs a
 * minutes figure with the display text so the weekly hour total (used
 * instead of totalMiles for ultra) is computed from the same numbers shown
 * in the cell, not parsed back out of generated strings. */
function ultraClimbMinutes(phase: TrainingPlanRow['phase'], linearRatio: number): number {
  if (phase === 'Race Week') return 0;
  if (phase === 'Taper Phase') return 20;
  if (phase === 'Recovery Week') return 20;
  if (phase === 'Base Building') return 30;
  return linearRatio > 0.7 ? 40 : 35; // Build Phase: moderate -> race-specific as the plan progresses
}

function ultraClimbText(outdoor: boolean, phase: TrainingPlanRow['phase'], linearRatio: number): string {
  const min = ultraClimbMinutes(phase, linearRatio);
  if (min === 0) return 'Rest';
  if (phase === 'Taper Phase') return outdoor ? `Hill repeats — ${min} min, easy` : `Treadmill incline — ${min} min easy, 6% grade`;
  if (phase === 'Recovery Week') return outdoor ? `Hill repeats — ${min} min, easy climbing` : `Treadmill incline — ${min} min easy, 8% grade`;
  if (phase === 'Base Building') return outdoor ? `Hill repeats — ${min} min steady climbing` : `Treadmill incline — ${min} min steady, 8% grade`;
  if (linearRatio > 0.7) return outdoor ? 'Hill repeats — race-pace climbing, poles optional' : `StairMaster — ${min} min, race-pace climbing`;
  return outdoor ? 'Hill repeats — 6×3 min hard, jog recovery' : 'Treadmill HIIT — 6×3 min @ 10–12% incline';
}

function ultraStrengthMinutes(phase: TrainingPlanRow['phase']): number {
  if (phase === 'Race Week') return 0;
  if (phase === 'Taper Phase') return 15;
  if (phase === 'Recovery Week') return 20;
  if (phase === 'Base Building') return 30;
  return 35; // Build Phase
}

function ultraStrengthText(phase: TrainingPlanRow['phase']): string {
  const min = ultraStrengthMinutes(phase);
  if (min === 0) return 'Rest';
  if (phase === 'Base Building') return `Strength — ${min} min (eccentric legs, core)`;
  if (phase === 'Build Phase') return `Strength — ${min} min (single-leg stability, hip strength)`;
  if (phase === 'Recovery Week') return `Strength — ${min} min, easy`;
  return `Strength — ${min} min, light maintenance`; // Taper Phase
}

function ultraEasyMinutes(phase: TrainingPlanRow['phase']): number {
  if (phase === 'Race Week') return 0;
  if (phase === 'Taper Phase') return 25;
  if (phase === 'Recovery Week') return 35;
  if (phase === 'Base Building') return 40;
  return 45; // Build Phase
}

function ultraCrossMinutes(phase: TrainingPlanRow['phase']): number {
  if (phase === 'Race Week') return 0;
  return phase === 'Taper Phase' ? 20 : 30;
}

function ultraCrossText(week: number, phase: TrainingPlanRow['phase']): string {
  const min = ultraCrossMinutes(phase);
  if (min === 0) return 'Rest';
  // Alternates bike/swim week to week rather than fixing one modality, per
  // the "bike / swim, at least once a week" ask — either is fine, this just
  // gives variety instead of the same cross-train session every week.
  const modality = week % 2 === 0 ? 'Swim' : 'Bike';
  return `${modality} — ${min} min, recovery effort`;
}

/** Ultra-specific plan: hours (not miles) drive the long runs, back-to-back
 * weekend long runs kick in once Build Phase begins (never during Base —
 * see the strategy discussion this was built from), plus a weekly strength
 * session and a weekly bike/swim cross-train session. Tuesday's
 * climbing-specific session swaps between outdoor hill repeats and
 * treadmill-incline/StairMaster equivalents based on hillAccess. Phase
 * boundaries (taper length, recovery-week cadence, base-vs-build cutoff)
 * intentionally mirror generateDynamicPlan's so both generators produce the
 * same overall plan shape. */
function generateUltraPlan(totalWeeks: number, firstTime: FirstTimeAnswer, hillAccess: HillAccessAnswer, raceMiles: number): RawPlanRow[] {
  const factor = firstTime === 'yes' ? 0.85 : 1;
  const outdoor = hillAccess !== 'no'; // default to outdoor unless the person explicitly said no hill access

  const taperWeeks = totalWeeks >= 10 ? 3 : totalWeeks >= 5 ? 2 : 1;
  const buildWeeks = totalWeeks - taperWeeks;

  const START_LONG_H = 2;
  const PEAK_LONG_H = 6;
  const START_B2B_H = 1.5;
  const PEAK_B2B_H = 3;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const rows: RawPlanRow[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    let phase: TrainingPlanRow['phase'];
    if (week === totalWeeks) phase = 'Race Week';
    else if (week > totalWeeks - taperWeeks) phase = 'Taper Phase';
    else if (week % 4 === 0 && week < buildWeeks) phase = 'Recovery Week';
    else if (week <= Math.max(4, Math.floor(totalWeeks / 4))) phase = 'Base Building';
    else phase = 'Build Phase';

    const linearRatio = buildWeeks > 1 ? Math.min(1, (week - 1) / (buildWeeks - 1)) : 1;

    let longHours = 0;
    let b2bHours = 0;
    if (phase === 'Taper Phase') {
      const taperStep = totalWeeks - week;
      longHours = round1(Math.max(1.5, 2 + taperStep));
    } else if (phase === 'Recovery Week') {
      longHours = round1((START_LONG_H + linearRatio * (PEAK_LONG_H - START_LONG_H)) * 0.65 * factor);
    } else if (phase === 'Base Building') {
      longHours = round1((START_LONG_H + linearRatio * (PEAK_LONG_H - START_LONG_H)) * factor);
      // No back-to-backs during Base — introduced once Build Phase begins.
    } else if (phase === 'Build Phase') {
      longHours = round1((START_LONG_H + linearRatio * (PEAK_LONG_H - START_LONG_H)) * factor);
      b2bHours = round1((START_B2B_H + linearRatio * (PEAK_B2B_H - START_B2B_H)) * factor);
    }

    const climbText = ultraClimbText(outdoor, phase, linearRatio);
    const strengthText = ultraStrengthText(phase);
    const easyMin = ultraEasyMinutes(phase);
    const easyText = easyMin === 0 ? 'Rest' : `Easy run — ${easyMin} min`;
    const crossText = ultraCrossText(week, phase);

    let mon: string, tue: string, wed: string, thu: string, fri: string, sat: string, sun: string;
    if (phase === 'Race Week') {
      mon = 'Rest';
      tue = 'Easy shakeout — 20 min';
      wed = 'Rest';
      thu = 'Easy shakeout — 15 min';
      fri = 'Rest';
      sat = `${raceMiles} mi`;
      sun = 'Rest';
    } else {
      const hasB2B = b2bHours > 0;
      const satLabel = hasB2B ? 'Long run 1' : 'Long run';
      mon = 'Rest';
      tue = climbText;
      wed = strengthText;
      thu = easyText;
      fri = crossText;
      sat =
        longHours <= 0
          ? 'Rest'
          : phase === 'Taper Phase'
            ? `${satLabel} — ${longHours} hrs, easy`
            : hasB2B
              ? `${satLabel} — ${longHours} hrs, fueling: 60–90g carb/hr`
              : `${satLabel} — ${longHours} hrs, rolling terrain`;
      sun = hasB2B ? `Long run 2 — ${b2bHours} hrs, run tired (back-to-back)` : 'Rest';
    }

    const totalHours =
      phase === 'Race Week'
        ? round1(35 / 60) // the two shakeout sessions only — race day itself isn't a "training" hours figure
        : round1(
            longHours +
              b2bHours +
              ultraClimbMinutes(phase, linearRatio) / 60 +
              ultraStrengthMinutes(phase) / 60 +
              easyMin / 60 +
              ultraCrossMinutes(phase) / 60,
          );
    // total_miles is still required by the schema (not null) — a rough
    // estimate for storage only, since ultra terrain/pace vary too much for
    // this to be meaningful. The UI shows totalHours for ultra instead.
    const totalMiles = round1(totalHours * 3.3);

    rows.push({ week, phase, mon, tue, wed, thu, fri, sat, sun, totalMiles, totalHours });
  }
  return rows;
}

/** Walks forward from "next week, first Monday" to the week containing the
 * race date, then attaches the generated plan rows and marks the race week. */
export function buildTrainingPlan(
  raceDateStr: string,
  distanceGoal: DistanceGoal,
  firstTime: FirstTimeAnswer,
  raceName: string,
  hillAccess: HillAccessAnswer = '',
  // Only meaningful for distanceGoal === 'ultra' — the specific selected
  // distance in miles (50K/100K/.../300mi preset or a custom entry, capped
  // at 500). Null falls back to the generic 31-mile ultra default.
  ultraMiles: number | null = null,
): TrainingPlan | null {
  if (!raceDateStr || !distanceGoal) return null;
  const race = new Date(raceDateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start = new Date(today);
  start.setDate(start.getDate() + 7);
  const dow = start.getDay();
  start.setDate(start.getDate() + (dow === 0 ? -6 : 1 - dow));
  if (start > race) start = new Date(race);

  const weeks: { weekStart: Date; weekEnd: Date; weekNum: number; containsRace: boolean }[] = [];
  const cursor = new Date(start);
  let weekNum = 1;
  while (weekNum <= 32) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const containsRace = race >= weekStart && race <= weekEnd;
    weeks.push({ weekStart, weekEnd, weekNum, containsRace });
    if (containsRace) break;
    cursor.setDate(cursor.getDate() + 7);
    weekNum++;
  }

  const totalWeeks = weeks.length;
  const dayKeyByDow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const raceKey = dayKeyByDow[race.getDay()];
  const planRows =
    distanceGoal === 'ultra'
      ? generateUltraPlan(totalWeeks, firstTime, hillAccess, ultraMiles ?? PLAN_TARGETS.ultra.raceMiles)
      : generateDynamicPlan(totalWeeks, distanceGoal, firstTime);

  const rows: TrainingPlanRow[] = weeks.map((wk) => {
    const p = planRows[wk.weekNum - 1];
    const cells = { mon: p.mon, tue: p.tue, wed: p.wed, thu: p.thu, fri: p.fri, sat: p.sat, sun: p.sun };
    if (wk.containsRace) {
      (cells as any)[raceKey] = 'RACE DAY — ' + p.sat;
      if (raceKey !== 'sat') cells.sat = 'Rest';
    }
    return {
      week: wk.weekNum,
      phase: p.phase,
      ...cells,
      totalMiles: p.totalMiles,
      totalHours: p.totalHours,
      isRaceWeek: wk.containsRace,
    };
  });

  return {
    raceName: raceName || DISTANCE_LABELS[distanceGoal],
    distanceGoal,
    firstTime,
    hillAccess: distanceGoal === 'ultra' ? hillAccess : '',
    raceDate: raceDateStr,
    totalWeeks,
    rows,
    phases: buildPhaseSummary(totalWeeks),
    quote: RUNNING_QUOTES[Math.floor(Math.random() * RUNNING_QUOTES.length)],
  };
}

/** "You have X months to train if you start next week" helper for onboarding step 4. */
export function monthsLeftLabel(raceDateStr: string): string {
  if (!raceDateStr) return '';
  const start = new Date();
  start.setDate(start.getDate() + 7);
  const race = new Date(raceDateStr + 'T00:00:00');
  const totalDays = Math.round((race.getTime() - start.getTime()) / 86400000);
  if (totalDays <= 0) return 'less than a week';
  const months = totalDays / 30.44;
  if (months < 1) return `${totalDays} day${totalDays === 1 ? '' : 's'}`;
  const rounded = Math.round(months * 10) / 10;
  return `${rounded} month${rounded === 1 ? '' : 's'}`;
}
