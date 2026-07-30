import type { AppState } from '../types';
import { DISTANCE_LABELS, PACES_KM, PACES_MI } from '../data/constants';
import { durationToSeconds, paceLabelPerMile } from '../lib/format';

export function homeStats(state: AppState) {
  const runs = state.loggedRuns;
  const totalMiles = runs.reduce((sum, r) => sum + (parseFloat(r.distance) || 0), 0);
  const totalSeconds = runs.reduce((sum, r) => sum + durationToSeconds(r.duration), 0);
  const avgPaceLabel = paceLabelPerMile(totalMiles, totalSeconds);
  return [
    { label: 'This week', value: totalMiles > 0 ? totalMiles.toFixed(1) + ' mi' : '0 mi' },
    { label: 'Runs logged', value: String(runs.length) },
    { label: 'Current streak', value: runs.length > 0 ? runs.length + ' days' : '0 days' },
    { label: 'Avg. pace', value: avgPaceLabel },
  ];
}

export function paceLabel(state: AppState): string {
  const { pace, customPace, paceUnit } = state.onboarding;
  if (pace === 'custom') {
    return customPace ? `${customPace} ${paceUnit === 'km' ? 'min/km' : 'min/mi'}` : 'Set a pace';
  }
  const found = [...PACES_MI, ...PACES_KM].find((p) => p.id === pace);
  return found?.label || 'Set a pace';
}

export function distanceGoalLabel(state: AppState): string {
  return state.onboarding.distanceGoal ? DISTANCE_LABELS[state.onboarding.distanceGoal] : 'Set a goal';
}

export function runElapsedLabel(elapsedSeconds: number): string {
  const mm = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
  const ss = (elapsedSeconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function runPaceLabel(elapsedSeconds: number, distanceMiles: number): string {
  if (distanceMiles <= 0.05) return '—:—';
  const paceMinPerMi = elapsedSeconds / 60 / distanceMiles;
  return `${Math.floor(paceMinPerMi)}:${Math.round((paceMinPerMi % 1) * 60).toString().padStart(2, '0')}/mi`;
}
