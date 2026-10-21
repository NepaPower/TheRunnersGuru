import type { DistanceGoal, FirstTimeAnswer, GpxRoute, HillAccessAnswer, PhaseSummaryItem, TrainingPlan, TrainingPlanRow } from '../types';
import { DISTANCE_LABELS, RUNNING_QUOTES } from '../data/constants';

/**
 * Ported from the user-supplied Python function `generate_dynamic_marathon_plan`
 * (via the prototype's JS port, `generateDynamicPlan`). Keep the phase logic
 * as-is if you touch this file. PLAN_TARGETS.peakLong values ARE an
 * intentional product spec (5K->3mi, 10K->6mi, Half->12mi, Marathon->24mi)
 * set directly by the user — not placeholders, but also not fixed forever;
 * change them again only on an explicit request, same as this one was.
 */

interface PlanTargets {
  startLong: number;
  peakLong: number;
  startWeekly: number;
  peakWeekly: number;
  raceMiles: number;
}

// Peak long-run distances are an explicit product spec (not derived): the
// longest training run should reach 5K->3mi, 10K->6mi, Half->12mi,
// Marathon->24mi — i.e. matching (or, for the marathon, deliberately
// exceeding) race distance, rather than the more conservative "cap around
// 20-22mi" convention some marathon plans use. Ultra is untouched — its
// long runs are generated separately (see generateUltraPlan) and were
// never distance-capped the same way.
const PLAN_TARGETS: Record<DistanceGoal, PlanTargets> = {
  '5k': { startLong: 2, peakLong: 3, startWeekly: 10, peakWeekly: 20, raceMiles: 3.1 },
  '10k': { startLong: 3, peakLong: 6, startWeekly: 12, peakWeekly: 25, raceMiles: 6.2 },
  half: { startLong: 5, peakLong: 12, startWeekly: 15, peakWeekly: 32, raceMiles: 13.1 },
  full: { startLong: 8, peakLong: 24, startWeekly: 16, peakWeekly: 48, raceMiles: 26.2 },
  ultra: { startLong: 8, peakLong: 26, startWeekly: 20, peakWeekly: 60, raceMiles: 31 },
};

/** What the runner can do today, from onboarding. Either figure may be null
 * (skipped, or a race saved before these were asked): with neither, plans are
 * built exactly as they always were, from fixed per-distance starting points. */
export interface RunnerBase {
  weeklyMiles: number | null;
  longestRunMiles: number | null;
}

/** The most a long run (or a week's volume) can safely grow, week on week. */
const MAX_WEEKLY_GROWTH = 1.1;

/** Ultra long runs are planned in hours; this converts the runner's longest
 * run in miles at a long-run trail pace of about 12 min/mile. */
const LONG_RUN_MILES_PER_HOUR = 5;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Weeks of the build that can actually add load: every 4th week before the
 * last build week is a recovery week (same rule the generators use). The first
 * building week sits at the starting level, so the ramp has one step fewer. */
function rampSteps(buildWeeks: number): number {
  const recovery = Math.floor((buildWeeks - 1) / 4);
  return Math.max(0, buildWeeks - recovery - 1);
}

/** 'full': the time is enough to reach the race's target long run from where
 * the runner is. 'tight': at least half the gap can be closed, so the build
 * climbs to what is reachable. 'short': under half, so the plan holds fitness
 * and tapers instead of cramming a build. */
function rampTier(progress: number): RunwayTier {
  return progress >= 0.999 ? 'full' : progress >= 0.5 ? 'tight' : 'short';
}

interface StandardRamp {
  tier: RunwayTier;
  startLong: number;
  startWeekly: number;
  fullLong: number;
  fullWeekly: number;
  /** Where this plan actually peaks (== start when holding). */
  peakLong: number;
  peakWeekly: number;
  /** The long run a safe build could reach in the time available. */
  reachLong: number;
}

/** Base-aware ramp for the standard distances; null when no base is known. */
export function standardRamp(
  distanceGoal: DistanceGoal,
  totalWeeks: number,
  firstTime: FirstTimeAnswer,
  base?: RunnerBase | null,
): StandardRamp | null {
  if (!base || (base.weeklyMiles == null && base.longestRunMiles == null)) return null;
  const cfg = PLAN_TARGETS[distanceGoal] || PLAN_TARGETS['5k'];
  const factor = firstTime === 'yes' ? 0.85 : 1;
  const fullLong = cfg.peakLong * factor;
  const fullWeekly = cfg.peakWeekly * factor;
  const startLong = clamp(base.longestRunMiles ?? cfg.startLong, 1, fullLong);
  // A week has to hold the long run plus a few other runs.
  const startWeekly = clamp(Math.max(base.weeklyMiles ?? cfg.startWeekly, startLong * 1.5), 3, fullWeekly);
  const taper = totalWeeks >= 10 ? 3 : totalWeeks >= 5 ? 2 : 1;
  const grow = Math.pow(MAX_WEEKLY_GROWTH, rampSteps(totalWeeks - taper));
  const reachLong = Math.min(fullLong, startLong * grow);
  const reachWeekly = Math.min(fullWeekly, startWeekly * grow);
  const span = fullLong - startLong;
  const tier = rampTier(span <= 0.01 ? 1 : (reachLong - startLong) / span);
  return {
    tier,
    startLong,
    startWeekly,
    fullLong,
    fullWeekly,
    peakLong: tier === 'short' ? startLong : reachLong,
    peakWeekly: tier === 'short' ? startWeekly : reachWeekly,
    reachLong,
  };
}

const ULTRA_PEAK_LONG_H = 6;
/** The weekly long run starts at most this share of the race's peak long run. */
const MAX_START_SHARE_OF_PEAK = 0.7;

/** The peak Saturday long run for an ultra, in hours, by race distance: longer
 * races need longer long runs (6-9 hrs is normal for the build phase of a 100K
 * and up). Unknown distance keeps the old 6 hrs. */
export function ultraPeakLongHours(miles: number | null | undefined): number {
  if (miles == null) return ULTRA_PEAK_LONG_H;
  if (miles < 40) return 4; //  50K
  if (miles <= 55) return 5; //  50 miles
  if (miles <= 70) return 6; //  100K
  if (miles <= 110) return 7; // 100 miles
  if (miles <= 150) return 8; // 135 miles
  return 9; //                    200 miles and up
}

/** Ultra mid-week runs (Tue / Wed / Thu) climb to this many hours at the peak of
 * the build (about 10-13 miles at ultra pace); they start at about half the
 * runner's long run. Wednesday's run is as long as the other two; strength follows it. */
const ULTRA_PEAK_MID_H = 2;
const WED_RUN_RATIO = 1;
/** Sunday's back-to-back run, as a share of Saturday's long run (25 mi Saturday -> ~9-10 mi Sunday). */
const B2B_RATIO = 0.38;
/** A runner whose weekly long run already starts at this many hours or more (about 15 miles)
 * does the Sunday back-to-back from week 1; others begin it once the build starts. */
const EARLY_B2B_MIN_START_H = 3;

interface UltraRamp {
  tier: RunwayTier;
  startH: number;
  /** The race's peak long run in hours (see ultraPeakLongHours). */
  peakH: number;
  /** How much of the full build (start -> peak) is reachable, 0..1. */
  scale: number;
  /** The long run a short-runway plan holds, in hours. */
  holdH: number;
  reachH: number;
}

/** Base-aware ramp for ultras (long runs in hours); null without a longest run. */
export function ultraRamp(totalWeeks: number, base?: RunnerBase | null, ultraMiles?: number | null): UltraRamp | null {
  if (!base || base.longestRunMiles == null) return null;
  const peakH = ultraPeakLongHours(ultraMiles);
  // The weekly long run starts where the runner is, but never above 70% of this race's
  // peak: a longest run that was a one-off effort (a training 50-miler, say) isn't what
  // they repeat every Saturday, and starting at the peak would leave no build at all.
  const startH = clamp(base.longestRunMiles / LONG_RUN_MILES_PER_HOUR, 1, peakH * MAX_START_SHARE_OF_PEAK);
  const taper = totalWeeks >= 10 ? 3 : totalWeeks >= 5 ? 2 : 1;
  const reachH = Math.min(peakH, startH * Math.pow(MAX_WEEKLY_GROWTH, rampSteps(totalWeeks - taper)));
  const span = peakH - startH;
  const progress = span <= 0.01 ? 1 : (reachH - startH) / span;
  return {
    tier: rampTier(progress),
    peakH,
    startH,
    scale: clamp(progress, 0, 1),
    holdH: clamp(startH, 1, 4.5),
    reachH,
  };
}

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
export function buildPhaseSummary(totalWeeks: number, readiness = false): PhaseSummaryItem[] {
  if (!totalWeeks) return [];
  if (readiness) {
    // Short-runway ultra plan: no build, just hold fitness, rehearse, taper.
    const taper = shortRunwayTaperWeeks(totalWeeks);
    const prep = totalWeeks - taper;
    const out: PhaseSummaryItem[] = [];
    if (prep > 0) {
      out.push({
        label: 'Phase 1 (Weeks 1' + (prep > 1 ? '–' + prep : '') + ')',
        title: 'Hold Your Fitness & Rehearse Race Day',
      });
    }
    const from = prep + 1;
    out.push({
      label: 'Phase ' + (out.length + 1) + ' (Weeks ' + from + (totalWeeks > from ? '–' + totalWeeks : '') + ')',
      title: 'Taper & Race Day Preparation',
    });
    return out;
  }
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
  base?: RunnerBase | null,
): RawPlanRow[] {
  const cfg = PLAN_TARGETS[distanceGoal] || PLAN_TARGETS['5k'];
  const factor = firstTime === 'yes' ? 0.85 : 1;
  // With a known base the build starts from where the runner is and climbs no
  // faster than ~10% a week; without one, the fixed per-distance values apply.
  const ramp = standardRamp(distanceGoal, totalWeeks, firstTime, base);
  const readiness = ramp?.tier === 'short';
  const startLongRun = ramp ? ramp.startLong : cfg.startLong;
  const peakLongRun = ramp ? ramp.peakLong : cfg.peakLong * factor;
  const startWeeklyMiles = ramp ? ramp.startWeekly : cfg.startWeekly;
  const peakWeeklyMiles = ramp ? ramp.peakWeekly : cfg.peakWeekly * factor;
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
    else if (readiness) phase = 'Race Prep';
    else if (week <= Math.max(4, Math.floor(totalWeeks / 4))) phase = 'Base Building';
    else phase = 'Build Phase';

    let longRun: number;
    let totalMiles: number;
    const linearRatio = buildWeeks > 1 ? Math.min(1, (week - 1) / (buildWeeks - 1)) : 1;

    if (phase === 'Taper Phase') {
      // Scales down FROM this distance's own peak, not fixed absolute
      // numbers — those were tuned for marathon-scale mileage and could
      // end up exceeding the actual peak for shorter races (e.g. a taper
      // week showing more mileage than the 5K's own 3mi peak long run).
      // taperStep counts down to 1 as race week approaches; each step
      // reduces the fraction of peak used.
      const taperStep = totalWeeks - week;
      const longRunFraction = Math.min(1, 0.4 + taperStep * 0.2);
      const weeklyFraction = Math.min(1, 0.35 + taperStep * 0.2);
      longRun = Math.round(peakLongRun * longRunFraction);
      totalMiles = Math.round(peakWeeklyMiles * weeklyFraction);
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
      wed = '3 mi (Steady)';
      thu = 'Rest';
      fri = '2 mi (Shake)';
      sat = raceMiles.toFixed(1) + ' mi';
      sun = 'Rest';
    } else {
      const remMiles = Math.max(0, totalMiles - longRun);
      const tueMiles = Math.round(remMiles * 0.3);
      const wedMiles = Math.round(remMiles * 0.35);
      const thuMiles = Math.round(remMiles * 0.35);
      const tueStyle = readiness ? 'Easy' : week % 2 === 0 ? 'Intervals' : phase === 'Base Building' ? 'Easy' : 'Tempo';
      mon = 'Rest';
      tue = tueMiles > 0 ? tueMiles + ' mi (' + tueStyle + ')' : 'Rest';
      wed = wedMiles > 0 ? wedMiles + ' mi (Steady)' : 'Rest';
      thu = thuMiles > 0 ? thuMiles + ' mi (Easy)' : 'Rest';
      fri = 'Rest';
      sat = Math.round(longRun) + ' mi';
      sun = 'Rest';
    }
    rows.push({ week, phase, mon, tue, wed, thu, fri, sat, sun, totalMiles });
  }
  return rows;
}

/** How much of an ultra's recommended runway the plan has: 'full' (all of
 * it), 'tight' (half or more: the build is scaled down to fit) or 'short'
 * (under half: no time to add endurance, so the plan holds fitness instead).
 * Only the weeks matter here — onboarding doesn't ask for current mileage. */
export type RunwayTier = 'full' | 'tight' | 'short';

export function ultraRunwayTier(totalWeeks: number, ultraMiles: number | null | undefined): RunwayTier {
  const ratio = totalWeeks / recommendedUltraWeeks(ultraMiles ?? PLAN_TARGETS.ultra.raceMiles);
  return ratio >= 1 ? 'full' : ratio >= 0.5 ? 'tight' : 'short';
}

/** Taper length for the short-runway plan, counting race week. Longer than
 * the normal one (a short plan is mostly taper), but never the whole plan. */
function shortRunwayTaperWeeks(totalWeeks: number): number {
  return Math.max(1, Math.min(totalWeeks - 1, totalWeeks >= 6 ? 4 : 3));
}

/** The long run the short-runway plan holds (and never exceeds), in hours.
 * Cells also tell the runner not to go past their own longest run. */
const SHORT_RUNWAY_HOLD_H = 3;

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

/** "45 min", "1 hr 30 min", "2 hrs" (to the nearest 5 minutes by the caller). */
function fmtDur(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : h === 1 ? '1 hr' : `${h} hrs`;
}

/** Tuesday: a real mid-week run with the climbing built into it (not 30 minutes
 * of hill work on its own). The climbing portion follows the phase, outdoors or
 * on a treadmill / StairMaster. */
function ultraHillRunText(outdoor: boolean, phase: TrainingPlanRow['phase'], linearRatio: number, durMin: number): string {
  const dur = fmtDur(durMin);
  const climb = ultraClimbMinutes(phase, linearRatio);
  if (phase === 'Taper Phase' || phase === 'Recovery Week') {
    return outdoor ? `Hill run — ${dur} (easy climbing)` : `Incline run — ${dur} (easy, 6–8% grade)`;
  }
  if (phase === 'Base Building') {
    return outdoor ? `Hill run — ${dur} (${climb} min steady climbing)` : `Incline run — ${dur} (${climb} min steady at 8% grade)`;
  }
  if (linearRatio > 0.7) {
    return outdoor ? `Hill run — ${dur} (race-pace climbing, poles optional)` : `Incline run — ${dur} (race-pace climbing, StairMaster or 10–12% incline)`;
  }
  return outdoor ? `Hill run — ${dur} (6×3 min hard climbs, jog recovery)` : `Incline run — ${dur} (6×3 min at 10–12% incline)`;
}

function ultraStrengthMinutes(phase: TrainingPlanRow['phase']): number {
  if (phase === 'Race Week') return 0;
  if (phase === 'Race Prep') return 20;
  if (phase === 'Taper Phase') return 15;
  if (phase === 'Recovery Week') return 20;
  if (phase === 'Base Building') return 30;
  return 35; // Build Phase
}

function ultraStrengthText(phase: TrainingPlanRow['phase']): string {
  const min = ultraStrengthMinutes(phase);
  if (min === 0) return 'Rest';
  if (phase === 'Race Prep') return `Strength — ${min} min, light maintenance`;
  if (phase === 'Base Building') return `Strength — ${min} min (eccentric legs, core)`;
  if (phase === 'Build Phase') return `Strength — ${min} min (single-leg stability, hip strength)`;
  if (phase === 'Recovery Week') return `Strength — ${min} min, easy`;
  return `Strength — ${min} min, light maintenance`; // Taper Phase
}

function ultraEasyMinutes(phase: TrainingPlanRow['phase']): number {
  if (phase === 'Race Week') return 0;
  if (phase === 'Race Prep') return 35;
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
function generateUltraPlan(
  totalWeeks: number,
  firstTime: FirstTimeAnswer,
  hillAccess: HillAccessAnswer,
  raceMiles: number,
  weeksTier: RunwayTier = 'full',
  ultraMiles?: number | null,
  base?: RunnerBase | null,
): RawPlanRow[] {
  const factor = firstTime === 'yes' ? 0.85 : 1;
  // A known longest run decides the tier (can this runner reach a long enough
  // long run in the time?); otherwise it falls back to the weeks-only tier.
  const ramp = ultraRamp(totalWeeks, base, ultraMiles);
  const tier: RunwayTier = ramp ? ramp.tier : weeksTier;
  const holdH = ramp ? ramp.holdH : SHORT_RUNWAY_HOLD_H;
  const earlyB2B = !!ramp && ramp.startH >= EARLY_B2B_MIN_START_H;
  const outdoor = hillAccess !== 'no'; // default to outdoor unless the person explicitly said no hill access

  const readiness = tier === 'short';
  const taperWeeks = readiness ? shortRunwayTaperWeeks(totalWeeks) : totalWeeks >= 10 ? 3 : totalWeeks >= 5 ? 2 : 1;
  const buildWeeks = totalWeeks - taperWeeks;

  // 'tight': scale the build to the time there is. Squared so a plan with
  // 75% of the runway climbs to ~56% of the way to a full peak, not 75%.
  const buildScale = ramp
    ? tier === 'tight'
      ? ramp.scale
      : 1
    : tier === 'tight'
      ? Math.pow(totalWeeks / recommendedUltraWeeks(ultraMiles ?? PLAN_TARGETS.ultra.raceMiles), 2)
      : 1;
  const START_LONG_H = ramp ? ramp.startH : 2;
  const FULL_PEAK_H = ultraPeakLongHours(ultraMiles);
  const PEAK_LONG_H = START_LONG_H + (FULL_PEAK_H - START_LONG_H) * buildScale;
  // Mid-week runs: start at about half the long run, climb to 2 hours (less if the
  // build is scaled down), same shape as the long run's ramp.
  const MID_START_H = clamp(START_LONG_H * 0.5, 0.75, ULTRA_PEAK_MID_H);
  const MID_PEAK_H = MID_START_H + (ULTRA_PEAK_MID_H - MID_START_H) * buildScale;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const rows: RawPlanRow[] = [];
  for (let week = 1; week <= totalWeeks; week++) {
    let phase: TrainingPlanRow['phase'];
    if (week === totalWeeks) phase = 'Race Week';
    else if (week > totalWeeks - taperWeeks) phase = 'Taper Phase';
    else if (week % 4 === 0 && week < buildWeeks) phase = 'Recovery Week';
    else if (readiness) phase = 'Race Prep';
    else if (week <= Math.max(4, Math.floor(totalWeeks / 4))) phase = 'Base Building';
    else phase = 'Build Phase';

    const linearRatio = buildWeeks > 1 ? Math.min(1, (week - 1) / (buildWeeks - 1)) : 1;

    let longHours = 0;
    let b2bHours = 0;
    if (readiness) {
      // Hold, never build: a flat easy long run, stepping down into race week.
      const taperStep = totalWeeks - week;
      if (phase === 'Taper Phase') {
        longHours = round1(Math.min(holdH, Math.max(1.5, holdH * (0.25 + 0.25 * taperStep))) * factor);
      } else if (phase === 'Recovery Week') {
        longHours = round1(holdH * 0.65 * factor);
      } else if (phase === 'Race Prep') {
        longHours = round1(holdH * factor);
      }
    } else if (phase === 'Taper Phase') {
      const taperStep = totalWeeks - week;
      longHours = round1(Math.max(1.5, 2 + taperStep));
      // A scaled-down build must still taper to below its own peak.
      if (tier === 'tight') longHours = Math.min(longHours, round1(PEAK_LONG_H * 0.75 * factor));
    } else if (phase === 'Recovery Week') {
      longHours = round1((START_LONG_H + linearRatio * (PEAK_LONG_H - START_LONG_H)) * 0.65 * factor);
    } else if (phase === 'Base Building') {
      longHours = round1((START_LONG_H + linearRatio * (PEAK_LONG_H - START_LONG_H)) * factor);
      // Base weeks keep Sunday free unless the runner's long run already supports a
      // back-to-back (see EARLY_B2B_MIN_START_H); otherwise they begin with the Build Phase.
      if (earlyB2B) b2bHours = round1(longHours * B2B_RATIO);
    } else if (phase === 'Build Phase') {
      longHours = round1((START_LONG_H + linearRatio * (PEAK_LONG_H - START_LONG_H)) * factor);
      b2bHours = round1(longHours * B2B_RATIO);
    }

    // Tue / Wed / Thu run lengths in minutes (nearest 5). Hold-and-taper plans keep
    // their own short sessions below.
    let midH = 0;
    if (!readiness && phase !== 'Race Week') {
      const built = MID_START_H + linearRatio * (MID_PEAK_H - MID_START_H);
      if (phase === 'Taper Phase') midH = Math.max(0.75, MID_PEAK_H * Math.min(0.7, 0.35 + 0.2 * (totalWeeks - week)));
      else if (phase === 'Recovery Week') midH = built * 0.65 * factor;
      else midH = built * factor;
    }
    const toMin = (h: number) => Math.round((h * 60) / 5) * 5;
    const tueMin = toMin(midH);
    const wedRunMin = toMin(midH * WED_RUN_RATIO);
    const thuMin = tueMin;

    // Short-runway plan swaps the hill/climb and cross-train days for the two
    // things that still help with no time to build: gear and fuel rehearsal.
    const gearMin = phase === 'Race Week' ? 0 : phase === 'Race Prep' ? 45 : 30;
    const fuelMin = phase === 'Race Week' ? 0 : phase === 'Race Prep' ? 60 : phase === 'Recovery Week' ? 45 : 30;
    const climbText = readiness
      ? gearMin === 0
        ? 'Rest'
        : `Gear test run — ${gearMin} min easy, in your race shoes, pack and clothes, on race-like terrain`
      : ultraHillRunText(outdoor, phase, linearRatio, tueMin);
    const strengthText = ultraStrengthText(phase);
    const easyMin = ultraEasyMinutes(phase);
    const easyText = readiness ? (easyMin === 0 ? 'Rest' : `Easy run — ${easyMin} min`) : `Easy run — ${fmtDur(thuMin)}`;
    const crossText = readiness
      ? fuelMin === 0
        ? 'Rest'
        : `Fuel rehearsal — ${fuelMin} min easy, eat and drink on your race-day schedule`
      : ultraCrossText(week, phase);

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
      mon = readiness ? 'Rest' : 'Rest, or an easy swim';
      tue = climbText;
      wed = readiness ? strengthText : `Run — ${fmtDur(wedRunMin)} easy, then ${strengthText}`;
      thu = easyText;
      fri = crossText;
      sat =
        longHours <= 0
          ? 'Rest'
          : phase === 'Taper Phase'
            ? `${satLabel} — ${longHours} hrs, easy`
            : readiness
              ? `${satLabel} — up to ${longHours} hrs, easy (never longer than your current longest run)`
              : hasB2B
                ? `${satLabel} — ${longHours} hrs, fueling: 60–90g carb/hr`
                : `${satLabel} — ${longHours} hrs, rolling terrain`;
      sun = hasB2B ? `Long run 2 — ${b2bHours} hrs, easy, run tired (back-to-back)` : 'Rest';
    }

    const totalHours =
      phase === 'Race Week'
        ? round1(35 / 60) // the two shakeout sessions only — race day itself isn't a "training" hours figure
        : round1(
            longHours +
              b2bHours +
              (readiness ? gearMin / 60 + easyMin / 60 : tueMin / 60 + wedRunMin / 60 + thuMin / 60) +
              ultraStrengthMinutes(phase) / 60 +
              (readiness ? fuelMin : ultraCrossMinutes(phase)) / 60,
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
  // Only meaningful for distanceGoal === 'ultra' — the parsed course GPX
  // (distance/elevation/aid stations), if the person uploaded one. Not
  // used by the row generator yet — stored on the plan for the future
  // Crew Plan / aid-station ETA screen.
  gpxRoute: GpxRoute | null = null,
  // Total goal finish time in minutes (from onboarding's Total hours +
  // Minutes step), used by the Crew Plan screen's ETA predictions.
  goalFinishMinutes: number | null = null,
  // The runner's current weekly miles / longest run from onboarding, if given.
  // Shapes how the plan starts and how far it can safely climb.
  base: RunnerBase | null = null,
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
  const tier: RunwayTier =
    distanceGoal === 'ultra'
      ? ultraRamp(totalWeeks, base, ultraMiles)?.tier ?? ultraRunwayTier(totalWeeks, ultraMiles)
      : standardRamp(distanceGoal, totalWeeks, firstTime, base)?.tier ?? 'full';
  const planRows =
    distanceGoal === 'ultra'
      ? generateUltraPlan(totalWeeks, firstTime, hillAccess, ultraMiles ?? PLAN_TARGETS.ultra.raceMiles, tier, ultraMiles, base)
      : generateDynamicPlan(totalWeeks, distanceGoal, firstTime, undefined, base);

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
    // buildTrainingPlan is only used by onboarding, which creates the
    // user's primary race. The short "Add a race" flow builds its plan
    // object separately with isPrimary: false.
    isPrimary: true,
    raceName: raceName || DISTANCE_LABELS[distanceGoal],
    distanceGoal,
    ultraMiles: distanceGoal === 'ultra' ? ultraMiles : null,
    firstTime,
    hillAccess: distanceGoal === 'ultra' ? hillAccess : '',
    gpxRoute: distanceGoal === 'ultra' ? gpxRoute : null,
    raceDate: raceDateStr,
    raceStartTime: null,
    goalFinishMinutes,
    currentWeeklyMiles: base?.weeklyMiles ?? null,
    longestRunMiles: base?.longestRunMiles ?? null,
    crewNotes: {},
    courseSegments: null,
    mandatoryGearImage: null,
    mandatoryGearNotes: '',
    totalWeeks,
    rows,
    phases: buildPhaseSummary(totalWeeks, tier === 'short'),
    quote: RUNNING_QUOTES[Math.floor(Math.random() * RUNNING_QUOTES.length)],
  };
}

/** A rough "you really want at least this much runway" figure for an
 * ultra of the given distance — 15 weeks for a 50K up to ~24 for a
 * 200-miler. Not a hard rule: the plan still builds. Below it, there
 * isn't time to safely add new endurance, only to sharpen what's there. */
export function recommendedUltraWeeks(miles: number): number {
  return Math.round(Math.min(24, Math.max(14, 12 + miles / 12)));
}

/** Same idea for the standard road distances — deliberately generous
 * (padded for a first-timer needing to build a base, not just someone
 * sharpening an existing one) rather than the leanest plan that could
 * technically work. */
const STANDARD_RECOMMENDED_WEEKS: Record<'5k' | '10k' | 'half' | 'full', number> = {
  '5k': 8,
  '10k': 12,
  half: 12,
  full: 16,
};

/** The "aim for at least this many weeks" figure for any distance goal —
 * the distance-scaled ultra figure, or the standard-distance table above.
 * The single source both getTrainingTimeWarning and isTrainingTimeShort
 * key off, plus the always-visible recommendation on the onboarding
 * date/goal step. */
export function recommendedWeeksFor(distanceGoal: DistanceGoal, ultraMiles?: number | null): number {
  if (distanceGoal === 'ultra') return recommendedUltraWeeks(ultraMiles ?? PLAN_TARGETS.ultra.raceMiles);
  return STANDARD_RECOMMENDED_WEEKS[distanceGoal] ?? 12;
}

/** Whether a plan's timeline is too compressed to build new fitness
 * safely — the standard 12-week bar for road races, or the
 * distance-scaled bar for ultras — and the message to show. The plan
 * still gets built regardless; this is a heads-up, not a block. */
export function getTrainingTimeWarning(
  distanceGoal: DistanceGoal,
  totalWeeks: number,
  ultraMiles?: number | null,
  opts?: { base?: RunnerBase | null; firstTime?: FirstTimeAnswer },
): string | null {
  const weeks = `${totalWeeks} week${totalWeeks === 1 ? '' : 's'}`;
  const hrs = (h: number) => `${Math.round(h * 10) / 10} hours`;
  const mi = (m: number) => `${Math.round(m)} mi`;

  // With the runner's real numbers the question is "can they get there from
  // here in the time?", not just how many weeks there are.
  if (distanceGoal === 'ultra') {
    const r = ultraRamp(totalWeeks, opts?.base, ultraMiles);
    if (r && opts?.base?.longestRunMiles != null) {
      if (r.tier === 'full') return null;
      const label = ultraMiles ? `${ultraMiles}-mile ultra` : 'ultra';
      const now = `Your longest recent run is about ${hrs(r.startH)} and your race is ${weeks} out.`;
      if (r.tier === 'tight') {
        return `${now} Adding about 10% a week, a long run can safely reach about ${hrs(r.reachH)} by race week, short of the ${hrs(r.peakH)} a full ${label} plan builds to. So the plan below builds more gently and peaks at about ${hrs(r.reachH)}, with the usual taper. Protect your recovery, rehearse your fuelling on long runs, and put the rest of your prep into race-day execution: conservative early pacing, hiking the climbs, and a foot / blister / chafe plan.`;
      }
      return `${now} Adding about 10% a week, you could safely reach about ${hrs(r.reachH)}, which is less than halfway to the ${hrs(r.peakH)} a full ${label} plan builds to. That's too little gain to be worth the injury risk this close to race day, so the plan below doesn't try to build: it holds your long run at about ${hrs(r.holdH)}, swaps the hill and cross-training days for gear-test and fuel-rehearsal runs, and tapers into race week. Guard recovery and sleep, and put the rest of your prep into race-day execution: rehearsed fuelling, conservative early pacing, deliberate hiking, and a foot / blister / chafe plan. If your longest run is well short of race demands, seriously consider a longer-runway race or a more conservative goal.`;
    }
  } else {
    const r = standardRamp(distanceGoal, totalWeeks, opts?.firstTime ?? '', opts?.base);
    if (r) {
      if (r.tier === 'full') return null;
      const label = DISTANCE_LABELS[distanceGoal] ?? 'this race';
      const now = `Your longest recent run is about ${mi(r.startLong)} and your race is ${weeks} away.`;
      if (r.tier === 'tight') {
        return `${now} Adding about 10% a week, a long run can safely reach about ${mi(r.reachLong)} by race week, short of the ${mi(r.fullLong)} a full ${label} plan builds to. So the plan below builds more gently and peaks at about ${mi(r.reachLong)}, with the usual taper. Prioritize recovery, and rehearse your race-day fuelling and pacing.`;
      }
      return `${now} Adding about 10% a week, you could safely reach about ${mi(r.reachLong)}, which is less than halfway to the ${mi(r.fullLong)} a full ${label} plan builds to. That's too little gain to be worth the injury risk this close to race day, so the plan below doesn't try to build: it holds your long run at about ${mi(r.startLong)}, keeps the other runs easy (no intervals or tempo), and tapers into race week. Put the rest of your preparation into race-day execution: fuelling, pacing and gear. If this is your first ${label}, consider a race further out or a more modest goal.`;
    }
  }

  if (distanceGoal === 'ultra') {
    const miles = ultraMiles ?? PLAN_TARGETS.ultra.raceMiles;
    const want = recommendedUltraWeeks(miles);
    if (totalWeeks >= want) return null;
    const label = ultraMiles ? `${ultraMiles}-mile` : '50K+';
    if (ultraRunwayTier(totalWeeks, ultraMiles) === 'tight') {
      return `Your race is ${totalWeeks} weeks out — a ${label} ultra ideally has ${want}+ weeks of runway. There's time to build, but not a full build, so the plan below climbs more gently: long runs and back-to-backs peak lower than a full plan's, with the same taper. Protect your recovery, rehearse your fuelling on long runs, and put the rest of your prep into race-day execution: conservative early pacing, hiking the climbs, and a foot / blister / chafe plan.`;
    }
    return `Your race is ${totalWeeks} week${totalWeeks === 1 ? '' : 's'} out — a ${label} ultra ideally has ${want}+ weeks of runway, and there isn't time to safely build new endurance for this distance now. So the plan below doesn't try to build: it holds your long runs at an easy, steady level (never longer than your current longest run), swaps the hill and cross-training days for gear-test and fuel-rehearsal runs, and tapers into race week. Guard recovery and sleep, and put the rest of your prep into race-day execution — fuelling and hydration you've actually rehearsed, conservative early pacing, deliberate hiking on the climbs, and a foot / blister / chafe plan. If your current longest run is well short of race demands, seriously consider a longer-runway race or a more conservative goal.`;
  }
  const want = recommendedWeeksFor(distanceGoal);
  if (totalWeeks >= want) return null;
  const label = DISTANCE_LABELS[distanceGoal] ?? 'this race';
  return `Your race is only ${totalWeeks} week${totalWeeks === 1 ? '' : 's'} away — a ${label} ideally has ${want}+ weeks of runway to build up safely, especially if it's your first time at the distance. You'll still get a full plan below, but expect a faster ramp-up in volume and less margin for missed days or setbacks than a longer buildup would allow.`;
}

/** Same idea as getTrainingTimeWarning, but usable during onboarding
 * before a plan (and its totalWeeks) exists yet — just needs a race date.
 * The bar is the standard 12 weeks for a road race, or the
 * distance-scaled recommendedUltraWeeks for an ultra. Uses the same
 * "start = next week" reference point as monthsLeftLabel. */
export function isTrainingTimeShort(
  raceDateStr: string,
  distanceGoal?: DistanceGoal,
  ultraMiles?: number | null,
  opts?: { base?: RunnerBase | null; firstTime?: FirstTimeAnswer },
): boolean {
  if (!raceDateStr) return false;
  const start = new Date();
  start.setDate(start.getDate() + 7);
  const race = new Date(raceDateStr + 'T00:00:00');
  const totalDays = Math.round((race.getTime() - start.getTime()) / 86400000);
  if (totalDays <= 0) return false;
  // With the runner's numbers known, "short" means they can't safely reach the
  // race's target from where they are (the plan's own tier decides), not just
  // that the date is closer than the usual recommended weeks.
  if (distanceGoal && opts?.base) {
    const planWeeks = Math.floor(totalDays / 7) + 1;
    const tier =
      distanceGoal === 'ultra'
        ? ultraRamp(planWeeks, opts.base, ultraMiles)?.tier
        : standardRamp(distanceGoal, planWeeks, opts.firstTime ?? '', opts.base)?.tier;
    if (tier) return tier !== 'full';
  }
  const bar = distanceGoal ? recommendedWeeksFor(distanceGoal, ultraMiles) : 12;
  return totalDays / 7 < bar;
}

/** "You have X months to train if you start next week" helper for onboarding step 4. */
export function monthsLeftLabel(raceDateStr: string): string {
  if (!raceDateStr) return '';
  const start = new Date();
  start.setDate(start.getDate() + 7);
  const race = new Date(raceDateStr + 'T00:00:00');
  const totalDays = Math.round((race.getTime() - start.getTime()) / 86400000);
  if (totalDays <= 0) return 'less than a week';
  // Whole weeks (floored) so it never claims more runway than the
  // "recommended N+ weeks" comparison in isTrainingTimeShort allows.
  const weeks = Math.floor(totalDays / 7);
  const weeksSuffix = weeks >= 1 ? ` (${weeks} week${weeks === 1 ? '' : 's'})` : '';
  const months = totalDays / 30.44;
  if (months < 1) return `${totalDays} day${totalDays === 1 ? '' : 's'}${weeksSuffix}`;
  const rounded = Math.round(months * 10) / 10;
  return `${rounded} month${rounded === 1 ? '' : 's'}${weeksSuffix}`;
}
