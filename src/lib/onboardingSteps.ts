import type { DistanceGoal } from '../types';

/** The Hill access step only applies to ultra plans (climbing-specific
 * sessions need to know whether to prescribe outdoor hill repeats or the
 * treadmill-incline / StairMaster equivalents), so it's inserted right
 * after Distance & race only when distanceGoal === 'ultra'. */
const ONBOARDING_STEPS_DEFAULT = ['Distance & race', 'First time?', 'Pace', 'Race date & goal'] as const;
const ONBOARDING_STEPS_ULTRA = ['Distance & race', 'Hill access', 'First time?', 'Pace', 'Race date & goal'] as const;

export function onboardingStepLabels(distanceGoal: DistanceGoal | ''): readonly string[] {
  return distanceGoal === 'ultra' ? ONBOARDING_STEPS_ULTRA : ONBOARDING_STEPS_DEFAULT;
}
