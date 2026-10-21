import type { RaceCategory } from '../types';

/** Step 0 (Race type) is always the same. Step 1 (Distance & race) then
 * branches its content by raceCategory without changing the step count.
 * The Hill access step is only inserted for Ultra. */
const ONBOARDING_STEPS_STANDARD = ['Race type', 'Distance & race', 'First time?', 'Pace', 'Current running', 'Race date & goal'] as const;
const ONBOARDING_STEPS_ULTRA = [
  'Race type',
  'Ultra distance & race',
  'Hill access',
  'First time?',
  'Pace',
  'Current running',
  'Race date & goal',
] as const;

/** 'crew' = "I'm here to crew or pace someone": no plan questions, the one
 * step just leads on to Shared Plans. */
const ONBOARDING_STEPS_CREW = ['Race type'] as const;

export function onboardingStepLabels(raceCategory: RaceCategory): readonly string[] {
  if (raceCategory === 'crew') return ONBOARDING_STEPS_CREW;
  return raceCategory === 'ultra' ? ONBOARDING_STEPS_ULTRA : ONBOARDING_STEPS_STANDARD;
}
