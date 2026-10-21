import { Button } from './ui/Button';
import { dayNumberToLabel, todayInPlan } from '../lib/today';
import { displayWorkoutText, trainingPacesFor, workoutDetail, workoutKind } from '../lib/trainingPaces';
import type { TrainingPlan } from '../types';

function countdown(days: number): string {
  if (days === 0) return 'Race day';
  if (days === 1) return 'Race tomorrow';
  return `Race in ${days} days`;
}

/** "4 mi (Tempo)" -> "4 mi · Tempo"; "RACE DAY — 3.1 mi" -> "Race day — 3.1 mi". */
function workoutTitle(text: string): string {
  if (text.toLowerCase() === 'rest') return 'Rest day';
  return text.replace('RACE DAY', 'Race day').replace(/\s*\(([^)]+)\)/, ' · $1');
}

/** The first thing on Home: what today's workout is (and its pace), where
 * the plan stands, and how far away race day is. Before a plan starts or
 * after its race has passed it says so and points at the next step. */
export function TodayCard({
  plan,
  loggedToday,
  nextRace,
  onViewPlan,
  onAddRace,
  onOpenRaces,
}: {
  plan: TrainingPlan;
  loggedToday: boolean;
  /** The soonest upcoming race other than this plan's own, if any. */
  nextRace: { name: string; dateLabel: string; countdown: string } | null;
  onViewPlan: () => void;
  onAddRace: () => void;
  onOpenRaces: () => void;
}) {
  const now = new Date();
  const position = todayInPlan(plan, now);
  if (!position) return null;

  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isUltra = plan.distanceGoal === 'ultra';

  let headline: string;
  let detail: string | null = null;
  let meta: string | null = null;
  let actionLabel = 'View plan';
  let onAction = onViewPlan;

  if (position.status === 'during') {
    const { row, dayIndex, text, daysToRace } = position;
    const kind = workoutKind(dayIndex, text, row.isRaceWeek);
    const shown = isUltra ? text : displayWorkoutText(dayIndex, text, kind);
    const labeled = !isUltra && kind === 'long' && !shown.includes('(') ? `${shown} (Long run)` : shown;
    headline = workoutTitle(labeled);
    if (kind === 'rest' || text.toLowerCase() === 'rest') {
      detail = 'Recovery is part of the plan.';
    } else if (!isUltra) {
      const paces = trainingPacesFor(plan.distanceGoal, plan.goalFinishMinutes);
      if (paces) {
        detail = workoutDetail(kind, text, {
          distanceGoal: plan.distanceGoal,
          phase: row.phase,
          paces,
          unit: plan.paceUnit === 'km' ? 'km' : 'mi',
        });
      }
    }
    meta = `Week ${row.week} of ${plan.totalWeeks} · ${row.phase} · ${countdown(daysToRace)}`;
  } else if (position.status === 'before') {
    headline = `Your plan starts ${dayNumberToLabel(position.startDay)}`;
    detail = position.startsInDays === 1 ? 'Week 1 begins tomorrow.' : `Week 1 begins in ${position.startsInDays} days.`;
  } else {
    headline = `${plan.raceName} is behind you.`;
    const since =
      position.daysSinceRace === 0
        ? 'Nice work.'
        : `That was ${position.daysSinceRace} day${position.daysSinceRace === 1 ? '' : 's'} ago.`;
    if (nextRace) {
      detail = `${since} Up next: ${nextRace.name} — ${nextRace.dateLabel} (${nextRace.countdown}).`;
      actionLabel = 'My Races';
      onAction = onOpenRaces;
    } else {
      detail = `${since} Add your next race to keep going.`;
      actionLabel = 'Add a race';
      onAction = onAddRace;
    }
  }

  return (
    <section className="rg-today" aria-label="Today">
      <div className="rg-today-main">
        <div className="rg-today-eyebrow">Today · {dateLabel}</div>
        <h2 className="rg-today-title">{headline}</h2>
        {detail && <p className="rg-today-detail">{detail}</p>}
        {meta && <p className="rg-today-meta">{meta}</p>}
      </div>
      <div className="rg-today-side">
        {loggedToday && position.status === 'during' && <span className="rg-today-chip">Logged today ✓</span>}
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </section>
  );
}
