import type { DistanceGoal, FirstTimeAnswer, PhaseSummaryItem, TrainingPlan, TrainingPlanRow } from '../types';
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
function generateDynamicPlan(totalWeeks: number, distanceGoal: DistanceGoal, firstTime: FirstTimeAnswer): RawPlanRow[] {
  const cfg = PLAN_TARGETS[distanceGoal] || PLAN_TARGETS['5k'];
  const factor = firstTime === 'yes' ? 0.85 : 1;
  const startLongRun = cfg.startLong;
  const peakLongRun = cfg.peakLong * factor;
  const startWeeklyMiles = cfg.startWeekly;
  const peakWeeklyMiles = cfg.peakWeekly * factor;
  const raceMiles = cfg.raceMiles;

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

/** Walks forward from "next week, first Monday" to the week containing the
 * race date, then attaches the generated plan rows and marks the race week. */
export function buildTrainingPlan(
  raceDateStr: string,
  distanceGoal: DistanceGoal,
  firstTime: FirstTimeAnswer,
  raceName: string,
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
  const planRows = generateDynamicPlan(totalWeeks, distanceGoal, firstTime);

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
      isRaceWeek: wk.containsRace,
    };
  });

  return {
    raceName: raceName || DISTANCE_LABELS[distanceGoal],
    distanceGoal,
    firstTime,
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
