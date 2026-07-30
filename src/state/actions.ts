import type { Address, DistanceGoal, FirstTimeAnswer, LoggedRun, PaceChoice, PaceUnit, ProfileTab, Screen } from '../types';

export type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SIGNUP_SUBMIT'; name: string; address: Address }
  | { type: 'SIGNIN_SUBMIT' }
  | { type: 'LOGOUT' }
  | { type: 'ONBOARDING_SELECT_DISTANCE'; id: DistanceGoal }
  | { type: 'ONBOARDING_EDIT_DISTANCE' }
  | { type: 'ONBOARDING_SET_RACE_CHOICE'; value: string }
  | { type: 'ONBOARDING_SET_RACE_NAME'; value: string }
  | { type: 'ONBOARDING_SET_RACE_ADDRESS'; value: string }
  | { type: 'ONBOARDING_SELECT_FIRST_TIME'; id: FirstTimeAnswer }
  | { type: 'ONBOARDING_SELECT_PACE_UNIT'; unit: PaceUnit }
  | { type: 'ONBOARDING_SELECT_PACE'; id: PaceChoice }
  | { type: 'ONBOARDING_SET_CUSTOM_PACE'; value: string }
  | { type: 'ONBOARDING_SET_RACE_DATE'; value: string }
  | { type: 'ONBOARDING_SET_GOAL_HOURS'; value: string }
  | { type: 'ONBOARDING_SET_GOAL_MINUTES'; value: string }
  | { type: 'ONBOARDING_NEXT' }
  | { type: 'ONBOARDING_PREV' }
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
  | { type: 'LOG_RUN_ADD' }
  | { type: 'LOG_RUN_SET_TEMP'; id: string; label: string }
  | { type: 'ADDRESS_FIELD_CHANGE'; field: keyof Address; value: string }
  | { type: 'ADDRESS_SAVE' }
  | { type: 'JOIN_EVENT_TOGGLE' }
  | { type: 'LOGGED_RUNS_LOADED'; runs: LoggedRun[] };
