import type { RaceCategory } from '../types';

/** Step 0 (Race type) is always the same. Step 1 (Distance & race) then
 * branches its content by raceCategory without changing the step count.
 * The Hill access step is only inserted for Ultra. */
const ONBOARDING_STEPS_STANDARD = ['Race type', 'Distance & race', 'First time?', 'Pace', 'Race date & goal'] as const;
const ONBOARDING_STEPS_ULTRA = [
  'Race type',
  'Ultra distance & race',
  'Hill access',
  'First time?',
  'Pace',
  'Race date & goal',
] as const;

export function onboardingStepLabels(raceCategory: RaceCategory): readonly string[] {
  return raceCategory === 'ultra' ? ONBOARDING_STEPS_ULTRA : ONBOARDING_STEPS_STANDARD;
}
