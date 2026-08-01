// Core domain types for The Runners Guru.
// Mirrors the state shape described in the design handoff README, ported
// from the prototype's single-component `state` object into typed slices.

export type Screen =
  | 'landing'
  | 'signup'
  | 'signin'
  | 'onboarding'
  | 'home'
  | 'trainingPlan'
  | 'logRun'
  | 'partners'
  | 'run'
  | 'chat'
  | 'profile'
  | 'gears' // "coming soon" placeholder nav card
  | 'nutrition' // "coming soon" placeholder nav card
  | 'strength'; // "coming soon" placeholder nav card

export type DistanceGoal = '5k' | '10k' | 'half' | 'full' | 'ultra';

/** Step 1 of onboarding now asks this before any specific distance — it
 * determines whether Step 2 shows the standard 5K-Marathon picker or the
 * Ultra-specific one. */
export type RaceCategory = 'standard' | 'ultra' | '';

/** Only used when raceCategory === 'ultra'. 'custom' pairs with
 * OnboardingState.ultraCustomMiles (capped at MAX_ULTRA_MILES, see
 * data/constants.ts). */
export type UltraDistanceId = '50k' | '100k' | '100mi' | '135mi' | '200mi' | '300mi' | 'custom' | '';

/** Only used when distanceGoal === 'ultra' — the official race GPX, parsed
 * client-side (see lib/gpx.ts). We store the parsed summary (distance,
 * elevation, named waypoints), never the raw file — keeps this small
 * regardless of source file size, and it's the parsed data the future
 * Crew Plan / aid-station ETA screen actually needs. */
export interface GpxWaypoint {
  name: string;
  mile: number;
  elevationFt: number | null;
}

export interface GpxRoute {
  fileName: string;
  distanceMiles: number;
  elevationGainFt: number;
  elevationLossFt: number;
  waypoints: GpxWaypoint[];
}

export type FirstTimeAnswer = 'yes' | 'no' | '';

/** Only asked when distanceGoal === 'ultra' — determines whether the plan's
 * climbing-specific sessions are prescribed as outdoor hill repeats or their
 * treadmill-incline / StairMaster equivalents. */
export type HillAccessAnswer = 'yes' | 'no' | '';

export type PaceChoice = 'easy' | 'steady' | 'fast' | 'custom' | '';

export type PaceUnit = 'mi' | 'km';

export interface Address {
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface AuthState {
  name: string;
  firstName: string;
  email: string;
  address: Address;
}

export interface OnboardingState {
  // Step count is dynamic — see onboardingStepLabels() in lib/onboardingSteps.ts:
  // 5 steps for a standard (5K-Marathon) race, 6 for Ultra (adds the Hill
  // access step). Step 0 (Race type) is always the same.
  step: number;
  raceCategory: RaceCategory;
  distanceGoal: DistanceGoal | '';
  distanceEditing: boolean;
  ultraDistanceId: UltraDistanceId;
  ultraCustomMiles: string; // typed miles when ultraDistanceId === 'custom', clamped to MAX_ULTRA_MILES
  raceName: string;
  gpxRoute: GpxRoute | null; // only offered/used when raceCategory === 'ultra'
  hillAccess: HillAccessAnswer; // only meaningful when distanceGoal === 'ultra'
  firstTime: FirstTimeAnswer;
  pace: PaceChoice;
  paceUnit: PaceUnit;
  customPace: string;
  raceDate: string; // ISO yyyy-mm-dd
  goalHours: string;
  goalMinutes: string;
}

/** One row of the generated week-by-week training plan. */
export interface TrainingPlanRow {
  week: number;
  phase: 'Base Building' | 'Build Phase' | 'Recovery Week' | 'Taper Phase' | 'Race Week';
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
  totalMiles: number;
  totalHours?: number; // set (instead of relied-on totalMiles) for ultra plans — see planGenerator.ts generateUltraPlan
  isRaceWeek: boolean;
}

export interface PhaseSummaryItem {
  label: string; // "Phase 1 (Weeks 1–6)"
  title: string; // "Aerobic Foundation & Endurance Base"
}

export interface TrainingPlan {
  raceName: string;
  distanceGoal: DistanceGoal;
  firstTime: FirstTimeAnswer;
  hillAccess: HillAccessAnswer; // '' for non-ultra plans
  gpxRoute: GpxRoute | null; // '' for non-ultra plans, null if not provided
  raceDate: string;
  totalWeeks: number;
  rows: TrainingPlanRow[];
  phases: PhaseSummaryItem[];
  quote: string;
}

export interface LoggedRun {
  id: string;
  date: string; // yyyy-mm-dd
  distance: string; // miles, as entered
  duration: string; // formatted "1d 02:03:04" or "02:03:04"
  timeOfDay: string;
  paceLabel: string; // "8:32" (min:sec / mile)
  temperature: string; // "68°F" | "68°F (est.)" | "Looking up…"
  electrolytes: string; // "2x GU Energy" | "—"
  nutrition: string; // "1x Clif Bar" | "—"
  comment: string;
}

export type MatchStatus = 'pending' | 'accepted' | 'passed';

export interface PartnerMatch {
  id: string;
  name: string;
  initials: string;
  pace: 'Easy' | 'Steady' | 'Fast';
  distance: string; // "1.2 mi"
  tags: string[];
  status: MatchStatus;
}

export interface ChatMessage {
  from: 'me' | 'them';
  text: string;
}

export type ChatThreads = Record<string, ChatMessage[]>;

export interface RunSession {
  active: boolean;
  elapsedSeconds: number;
  distanceMiles: number;
}

export type ProfileTab = 'stats' | 'leaderboard' | 'challenges' | 'settings';

export interface AppState {
  screen: Screen;
  isAuthenticated: boolean;
  userId: string | null;
  auth: AuthState;
  onboarding: OnboardingState;
  trainingPlan: TrainingPlan | null; // generated ONCE, persisted, never recomputed
  matches: PartnerMatch[];
  activeChatId: string;
  chatMessages: ChatThreads;
  chatInput: string;
  run: RunSession;
  sosOpen: boolean;
  profileTab: ProfileTab;
  garminConnected: boolean;
  logForm: LogRunFormState;
  loggedRuns: LoggedRun[]; // persisted to localStorage
  joinedEvent: boolean;
  addressSaved: boolean;
}

export interface LogRunFormState {
  date: string;
  temperature: string;
  distance: string;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  timeOfDay: string;
  comment: string;
  nutritionCount: string;
  nutritionBrand: string;
  electrolytesCount: string;
  electrolytesBrand: string;
}
