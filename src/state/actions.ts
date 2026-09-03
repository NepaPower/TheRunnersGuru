import type {
  Address,
  DistanceGoal,
  FirstTimeAnswer,
  GpxRoute,
  HillAccessAnswer,
  LoggedRun,
  LogRunFormState,
  PaceChoice,
  PaceUnit,
  ProfileTab,
  RaceCategory,
  Screen,
  SharedPlanEntry,
  TrainingPlan,
  UltraDistanceId,
} from '../types';

export type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  // Fired once after a real Supabase session is found (on load, or right
  // after sign-up/sign-in) with whatever data exists for that user.
  | {
      type: 'AUTH_HYDRATE';
      userId: string;
      name: string;
      email: string;
      address: Address;
      garminConnected: boolean;
      trainingPlan: TrainingPlan | null;
      ownPlans: TrainingPlan[];
      loggedRuns: LoggedRun[];
      sharedPlans: SharedPlanEntry[];
    }
  | { type: 'LOGOUT' }
  | { type: 'ONBOARDING_SELECT_RACE_CATEGORY'; category: RaceCategory }
  | { type: 'ONBOARDING_SELECT_DISTANCE'; id: DistanceGoal }
  | { type: 'ONBOARDING_EDIT_DISTANCE' }
  | { type: 'ONBOARDING_SELECT_ULTRA_DISTANCE'; id: UltraDistanceId }
  | { type: 'ONBOARDING_SET_ULTRA_CUSTOM_MILES'; value: string }
  | { type: 'ONBOARDING_SET_RACE_NAME'; value: string }
  | { type: 'ONBOARDING_SET_GPX_ROUTE'; route: GpxRoute | null }
  | { type: 'ONBOARDING_SELECT_HILL_ACCESS'; id: HillAccessAnswer }
  | { type: 'ONBOARDING_SELECT_FIRST_TIME'; id: FirstTimeAnswer }
  | { type: 'ONBOARDING_SELECT_PACE_UNIT'; unit: PaceUnit }
  | { type: 'ONBOARDING_SELECT_PACE'; id: PaceChoice }
  | { type: 'ONBOARDING_SET_CUSTOM_PACE'; value: string }
  | { type: 'ONBOARDING_SET_RACE_DATE'; value: string }
  | { type: 'ONBOARDING_SET_GOAL_HOURS'; value: string }
  | { type: 'ONBOARDING_SET_GOAL_MINUTES'; value: string }
  | { type: 'ONBOARDING_NEXT' }
  | { type: 'ONBOARDING_PREV' }
  // Dispatched by the Onboarding screen after the generated plan has been
  // successfully saved to Supabase.
  | { type: 'ONBOARDING_PLAN_SAVED'; plan: TrainingPlan }
  | { type: 'MATCH_ACCEPT'; id: string }
  | { type: 'MATCH_PASS'; id: string }
  | { type: 'OPEN_CHAT_WITH'; id: string }
  | { type: 'CHAT_INPUT_CHANGE'; value: string }
  | { type: 'CHAT_SEND' }
  | { type: 'RUN_TOGGLE' }
  | { type: 'RUN_TICK' }
  | { type: 'SOS_OPEN' }
  | { type: 'SOS_CLOSE' }
  | { type: 'SOS_CONFIRM' }
  | { type: 'PROFILE_SET_TAB'; tab: ProfileTab }
  | { type: 'GARMIN_CONNECT' }
  | { type: 'GARMIN_DISCONNECT' }
  | { type: 'LOG_FORM_SET_FIELD'; field: string; value: string }
  | { type: 'LOG_FORM_SET_MANY'; fields: Partial<LogRunFormState> }
  // Dispatched by the Log a Run screen after a successful insert into Supabase.
  | { type: 'LOG_RUN_ADDED'; run: LoggedRun }
  | { type: 'LOG_RUN_UPDATED'; run: LoggedRun }
  | { type: 'LOG_RUN_DELETED'; id: string }
  | { type: 'LOG_RUN_SET_TEMP'; id: string; label: string }
  | { type: 'ADDRESS_FIELD_CHANGE'; field: keyof Address; value: string }
  | { type: 'AUTH_NAME_CHANGE'; value: string }
  // Dispatched after the address has been successfully saved to Supabase.
  | { type: 'ADDRESS_SAVED' }
  // Crew Plan edits to one specific race (by id) — keeps that entry in
  // `ownPlans` in sync, and `trainingPlan` too when it's the same race.
  | { type: 'PLAN_PATCHED'; planId: string; patch: Partial<TrainingPlan> }
  // Dispatched after "My Races → Add a race" inserts a new (non-primary) plan.
  | { type: 'PLAN_ADDED'; plan: TrainingPlan }
  // Dispatched after a race is deleted.
  | { type: 'PLAN_DELETED'; planId: string }
  // Dispatched after the primary-race flag is moved to `planId`.
  | { type: 'PRIMARY_CHANGED'; planId: string }
  | { type: 'JOIN_EVENT_TOGGLE' };
