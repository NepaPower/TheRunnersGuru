import type {
  Address,
  DistanceGoal,
  FirstTimeAnswer,
  GpxRoute,
  HillAccessAnswer,
  LoggedRun,
  PaceChoice,
  PaceUnit,
  ProfileTab,
  RaceCategory,
  Screen,
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
      address: Address;
      garminConnected: boolean;
      trainingPlan: TrainingPlan | null;
      loggedRuns: LoggedRun[];
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
  // Dispatched by the Log a Run screen after a successful insert into Supabase.
  | { type: 'LOG_RUN_ADDED'; run: LoggedRun }
  | { type: 'LOG_RUN_SET_TEMP'; id: string; label: string }
  | { type: 'ADDRESS_FIELD_CHANGE'; field: keyof Address; value: string }
  | { type: 'AUTH_NAME_CHANGE'; value: string }
  // Dispatched after the address has been successfully saved to Supabase.
  | { type: 'ADDRESS_SAVED' }
  | { type: 'TRAINING_PLAN_UPDATED'; patch: Partial<TrainingPlan> }
  | { type: 'JOIN_EVENT_TOGGLE' };
