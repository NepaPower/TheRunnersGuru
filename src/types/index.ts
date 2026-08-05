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
  | 'crewPlan'
  | 'sharedPlans' // list of plans this user crews for — landing spot for a pure crew member with no plan of their own
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
  lat: number | null;
  lon: number | null;
  // The rest are optional — only set if the source GPX actually included
  // them. Race organizer files vary a lot in how much they annotate.
  description?: string; // <desc>
  comment?: string; // <cmt> — some organizers put cutoff times or crew notes here
  symbol?: string; // <sym> — e.g. "Water Source", "Flag, Blue"
  waypointType?: string; // <type>
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

/** One row of crew_plan_access — a person granted collaborate access to a
 * plan's Crew Plan screen. 'pending' until someone signs in with a
 * matching email, at which point it becomes 'accepted' and that person
 * can view/edit the plan's Crew Plan fields (not the weekly training
 * schedule — that stays owner-only). */
export interface CrewAccessEntry {
  id: string;
  invitedEmail: string;
  status: 'pending' | 'accepted';
  // 'chief' is the only role allowed to replace the course GPX file —
  // enforced at the database level (a trigger + a partial unique index
  // guaranteeing at most one chief per plan), not just hidden in the UI.
  role: 'crew' | 'chief';
}

/** Free-text crew notes for one aid station on the Crew Plan screen, keyed
 * by that waypoint's index in gpxRoute.waypoints (as a string, since object
 * keys are always strings — see routes/CrewPlan.tsx). */
export interface CrewNoteEntry {
  nutrition: string;
  hydration: string;
  gear: string;
  crewAccess: 'yes' | 'no' | 'sleep' | ''; // whether crew can meet the runner here, or it's a planned sleep stop
  // Single free-text field ("Day 1, 10:00 PM" style) rather than separate
  // day/time inputs — cutoffs are announced in wildly inconsistent formats
  // across races, so a single editable field is more honest than forcing a
  // structured shape we can't reliably parse from every course file.
  cutoff: string;
  // Planned time spent AT this station (beyond just passing through) —
  // hours/minutes, numeric (unlike cutoff) since it feeds directly into
  // every downstream station's predicted arrival time. See
  // lib/crewPlan.ts computeElapsedWithRests.
  restHours: string;
  restMinutes: string;
  // Avg min/mile pace override for the segment AFTER this station —
  // reflects how the runner is actually doing (vs. the flat initial pace
  // from goal time ÷ distance), and cascades forward until the next
  // station overrides it again. See lib/crewPlan.ts computeStationTimings.
  avgPaceMin: string;
  avgPaceSec: string;
  // Whether crew has (or should have) a drop bag and/or a pacer waiting
  // at this station — both runner and crew need this visible up front,
  // not buried in a notes field.
  dropBag: boolean;
  pacerPickup: boolean;
}

export interface TrainingPlan {
  // The DB row's own id — undefined only in the brief window between
  // building a fresh plan (buildTrainingPlan) and it actually being saved.
  // Needed to invite crew members and to route to a specific shared plan.
  id?: string;
  raceName: string;
  distanceGoal: DistanceGoal;
  firstTime: FirstTimeAnswer;
  hillAccess: HillAccessAnswer; // '' for non-ultra plans
  gpxRoute: GpxRoute | null; // '' for non-ultra plans, null if not provided
  raceDate: string;
  // Race-day start time (HH:MM, 24h) — set on the Crew Plan screen, not
  // during onboarding, since it's often confirmed later than sign-up.
  raceStartTime: string | null;
  // Total goal finish time in minutes, from onboarding's goal-time step.
  // Used by the Crew Plan screen to predict aid-station arrival times.
  goalFinishMinutes: number | null;
  crewNotes: Record<string, CrewNoteEntry>;
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
  routePoints?: { lat: number; lon: number }[]; // only present for GPX-imported runs
  // Everything below is device-recorded metadata from a GPX import —
  // never a manual-entry field (nobody types their own heart rate).
  // Undefined for manually-entered runs.
  activityName?: string;
  activityType?: string;
  avgHeartRate?: number;
  maxHeartRate?: number;
  minHeartRate?: number;
  avgCadence?: number;
  maxCadence?: number;
  elevationGainFt?: number;
  elevationLossFt?: number;
  // Raw, form-shaped values for editing — everything above is
  // display-formatted and not safe to parse back apart.
  raw: {
    distanceMiles: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    timeOfDay: string;
    temperature: string; // numeric string only, e.g. "78" — matches the manual entry field's format
    electrolytesCount: number;
    electrolytesBrand: string;
    nutritionCount: number;
    nutritionBrand: string;
    comment: string;
  };
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

/** One plan shared with the current user as a crew member (not their own
 * plan) — see fetchSharedPlans in lib/api.ts. */
export interface SharedPlanEntry {
  accessId: string;
  ownerUserId: string;
  plan: TrainingPlan;
}

export interface AppState {
  screen: Screen;
  isAuthenticated: boolean;
  userId: string | null;
  auth: AuthState;
  onboarding: OnboardingState;
  trainingPlan: TrainingPlan | null; // generated ONCE, persisted, never recomputed
  sharedPlans: SharedPlanEntry[]; // plans this user crews for, not their own
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
  // Pre-filled from a GPX's activity name when one's uploaded (Garmin's
  // auto-generated names are usually location-based, e.g. "Rockville
  // Running") but freely editable — it's just a label, not device-recorded
  // biometric data.
  runLocation: string;
  comment: string;
  nutritionCount: string;
  nutritionBrand: string;
  electrolytesCount: string;
  electrolytesBrand: string;
}
