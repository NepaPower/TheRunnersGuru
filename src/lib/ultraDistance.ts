import type { OnboardingState } from '../types';
import { MAX_ULTRA_MILES, ULTRA_DISTANCES } from '../data/constants';

type UltraSelection = Pick<OnboardingState, 'ultraDistanceId' | 'ultraCustomMiles'>;

/** Returns the selected ultra distance in miles, or null if nothing valid
 * is selected yet (including an empty/zero custom entry). Always clamped
 * to MAX_ULTRA_MILES even if state somehow held a larger value. */
export function ultraDistanceMiles(onboarding: UltraSelection): number | null {
  if (onboarding.ultraDistanceId === 'custom') {
    const n = Number(onboarding.ultraCustomMiles);
    return onboarding.ultraCustomMiles && n > 0 ? Math.min(n, MAX_ULTRA_MILES) : null;
  }
  return ULTRA_DISTANCES.find((d) => d.id === onboarding.ultraDistanceId)?.miles ?? null;
}

/** Display label for the selected ultra distance, e.g. "100 Miles" or
 * "220 miles" for a custom entry. Empty string if nothing valid yet. */
export function ultraDistanceLabel(onboarding: UltraSelection): string {
  if (onboarding.ultraDistanceId === 'custom') {
    const miles = ultraDistanceMiles(onboarding);
    return miles ? `${miles} miles` : '';
  }
  return ULTRA_DISTANCES.find((d) => d.id === onboarding.ultraDistanceId)?.label ?? '';
}
