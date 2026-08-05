import type { AppState } from '../types';
import type { Action } from './actions';
import { SEED_MATCHES } from '../data/constants';
import { MAX_ULTRA_MILES } from '../data/constants';
import { onboardingStepLabels } from '../lib/onboardingSteps';

export const emptyLogForm = {
  date: '',
  temperature: '',
  distance: '',
  days: '0',
  hours: '0',
  minutes: '0',
  seconds: '0',
  timeOfDay: '',
  comment: '',
  nutritionCount: '0',
  nutritionBrand: '',
  electrolytesCount: '0',
  electrolytesBrand: '',
};

export function buildInitialState(): AppState {
  return {
    screen: 'landing',
    isAuthenticated: false,
    userId: null,
    auth: {
      name: '',
      firstName: '',
      email: '',
      address: { street: '', unit: '', city: '', state: '', zip: '', phone: '' },
    },
    onboarding: {
      step: 0,
      raceCategory: '',
      distanceGoal: '',
      distanceEditing: false,
      ultraDistanceId: '',
      ultraCustomMiles: '',
      raceName: '',
      gpxRoute: null,
      hillAccess: '',
      firstTime: '',
      pace: '',
      paceUnit: 'mi',
      customPace: '',
      raceDate: '',
      goalHours: '',
      goalMinutes: '',
    },
    trainingPlan: null,
    sharedPlans: [],
    // Partner matching and chat are still mocked client-side — see README
    // "Next steps" for the phased plan to move these onto real tables too.
    matches: SEED_MATCHES.map((m) => ({ ...m })),
    activeChatId: 'maya',
    chatMessages: {
      maya: [
        { from: 'them', text: "Hey! Ready for Saturday's trail loop?" },
        { from: 'me', text: 'Wouldn\'t miss it — meet at the trailhead at 6:15?' },
        { from: 'them', text: 'Perfect, see you there 🙌' },
      ],
    },
    chatInput: '',
    run: { active: false, elapsedSeconds: 0, distanceMiles: 0 },
    sosOpen: false,
    profileTab: 'stats',
    garminConnected: false,
    logForm: { ...emptyLogForm },
    loggedRuns: [],
    joinedEvent: false,
    addressSaved: false,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.screen };

    case 'AUTH_HYDRATE': {
      const firstName = action.name.trim().split(' ')[0] || 'Runner';
      const screen: AppState['screen'] = action.trainingPlan ? 'home' : action.sharedPlans.length > 0 ? 'sharedPlans' : 'onboarding';
      return {
        ...state,
        isAuthenticated: true,
        userId: action.userId,
        screen,
        auth: { ...state.auth, name: action.name, firstName, address: action.address },
        trainingPlan: action.trainingPlan,
        sharedPlans: action.sharedPlans,
        loggedRuns: action.loggedRuns,
        garminConnected: action.garminConnected,
      };
    }

    case 'LOGOUT':
      // All server-backed data (profile, plan, logged runs) simply isn't
      // fetched again until the next real sign-in — nothing to clear
      // server-side here, just reset the in-memory session.
      return buildInitialState();

    case 'ONBOARDING_SELECT_RACE_CATEGORY':
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          raceCategory: action.category,
          // Ultra sets distanceGoal immediately so downstream logic (Hill
          // access step, plan-target lookup) can key off it right away;
          // standard clears it so Step 2 re-prompts for a specific distance.
          distanceGoal: action.category === 'ultra' ? 'ultra' : '',
          distanceEditing: false,
          raceName: '',
          gpxRoute: null,
          ultraDistanceId: '',
          ultraCustomMiles: '',
          hillAccess: action.category === 'ultra' ? state.onboarding.hillAccess : '',
        },
      };

    case 'ONBOARDING_SELECT_DISTANCE':
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          distanceGoal: action.id,
          raceName: '',
          distanceEditing: false,
          hillAccess: '',
        },
      };

    case 'ONBOARDING_SELECT_ULTRA_DISTANCE':
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          ultraDistanceId: action.id,
          ultraCustomMiles: action.id === 'custom' ? state.onboarding.ultraCustomMiles : '',
          raceName: '',
        },
      };

    case 'ONBOARDING_SET_ULTRA_CUSTOM_MILES': {
      // Digits only, clamped to the 500-mile ceiling — enforced here too
      // (not just in the input) since this is the single source of truth.
      const digits = action.value.replace(/[^\d]/g, '');
      const clamped = digits === '' ? '' : String(Math.min(Number(digits), MAX_ULTRA_MILES));
      return { ...state, onboarding: { ...state.onboarding, ultraCustomMiles: clamped } };
    }

    case 'ONBOARDING_EDIT_DISTANCE':
      return { ...state, onboarding: { ...state.onboarding, distanceEditing: true } };

    case 'ONBOARDING_SET_RACE_NAME':
      return { ...state, onboarding: { ...state.onboarding, raceName: action.value } };

    case 'ONBOARDING_SET_GPX_ROUTE':
      return { ...state, onboarding: { ...state.onboarding, gpxRoute: action.route } };

    case 'ONBOARDING_SELECT_HILL_ACCESS':
      return { ...state, onboarding: { ...state.onboarding, hillAccess: action.id } };

    case 'ONBOARDING_SELECT_FIRST_TIME':
      return { ...state, onboarding: { ...state.onboarding, firstTime: action.id } };

    case 'ONBOARDING_SELECT_PACE_UNIT':
      return { ...state, onboarding: { ...state.onboarding, paceUnit: action.unit, pace: '' } };

    case 'ONBOARDING_SELECT_PACE':
      return { ...state, onboarding: { ...state.onboarding, pace: action.id } };

    case 'ONBOARDING_SET_CUSTOM_PACE':
      return { ...state, onboarding: { ...state.onboarding, customPace: action.value } };

    case 'ONBOARDING_SET_RACE_DATE':
      return { ...state, onboarding: { ...state.onboarding, raceDate: action.value } };

    case 'ONBOARDING_SET_GOAL_HOURS':
      return { ...state, onboarding: { ...state.onboarding, goalHours: action.value } };

    case 'ONBOARDING_SET_GOAL_MINUTES':
      return { ...state, onboarding: { ...state.onboarding, goalMinutes: action.value } };

    case 'ONBOARDING_NEXT': {
      // The final step (Race date & goal — index varies: 3 normally, 4 for
      // ultra plans with the Hill access step inserted) is handled entirely
      // by the Onboarding component: it generates the plan, awaits saving it
      // to Supabase, then dispatches ONBOARDING_PLAN_SAVED. This action only
      // advances the steps before that.
      const lastStep = onboardingStepLabels(state.onboarding.raceCategory).length - 1;
      if (state.onboarding.step < lastStep) {
        return { ...state, onboarding: { ...state.onboarding, step: state.onboarding.step + 1 } };
      }
      return state;
    }

    case 'ONBOARDING_PREV':
      if (state.onboarding.step === 0) return state;
      return { ...state, onboarding: { ...state.onboarding, step: state.onboarding.step - 1 } };

    case 'ONBOARDING_PLAN_SAVED':
      return { ...state, screen: 'home', trainingPlan: action.plan };

    case 'MATCH_ACCEPT':
      return { ...state, matches: state.matches.map((m) => (m.id === action.id ? { ...m, status: 'accepted' } : m)) };

    case 'MATCH_PASS':
      return { ...state, matches: state.matches.map((m) => (m.id === action.id ? { ...m, status: 'passed' } : m)) };

    case 'OPEN_CHAT_WITH':
      return { ...state, activeChatId: action.id, screen: 'chat' };

    case 'CHAT_INPUT_CHANGE':
      return { ...state, chatInput: action.value };

    case 'CHAT_SEND': {
      const text = state.chatInput.trim();
      if (!text) return state;
      const thread = state.chatMessages[state.activeChatId] || [];
      return {
        ...state,
        chatInput: '',
        chatMessages: { ...state.chatMessages, [state.activeChatId]: [...thread, { from: 'me', text }] },
      };
    }

    case 'RUN_TOGGLE':
      return state.run.active
        ? { ...state, run: { ...state.run, active: false } }
        : { ...state, run: { active: true, elapsedSeconds: 0, distanceMiles: 0 } };

    case 'RUN_TICK':
      if (!state.run.active) return state;
      return {
        ...state,
        run: { ...state.run, elapsedSeconds: state.run.elapsedSeconds + 1, distanceMiles: state.run.distanceMiles + 0.0028 },
      };

    case 'SOS_OPEN':
      return { ...state, sosOpen: true };
    case 'SOS_CLOSE':
    case 'SOS_CONFIRM':
      return { ...state, sosOpen: false };

    case 'PROFILE_SET_TAB':
      return { ...state, profileTab: action.tab };

    case 'GARMIN_CONNECT':
      return { ...state, garminConnected: true };
    case 'GARMIN_DISCONNECT':
      return { ...state, garminConnected: false };

    case 'LOG_FORM_SET_FIELD': {
      let value = action.value;
      if (action.field === 'temperature') value = value.replace('-', '');
      return { ...state, logForm: { ...state.logForm, [action.field]: value } };
    }

    case 'LOG_FORM_SET_MANY':
      return { ...state, logForm: { ...state.logForm, ...action.fields } };

    case 'LOG_RUN_ADDED':
      return { ...state, loggedRuns: [action.run, ...state.loggedRuns], logForm: { ...emptyLogForm } };

    case 'LOG_RUN_SET_TEMP':
      return { ...state, loggedRuns: state.loggedRuns.map((r) => (r.id === action.id ? { ...r, temperature: action.label } : r)) };

    case 'ADDRESS_FIELD_CHANGE':
      return { ...state, auth: { ...state.auth, address: { ...state.auth.address, [action.field]: action.value } } };

    case 'AUTH_NAME_CHANGE': {
      const firstName = action.value.trim().split(' ')[0] || state.auth.firstName;
      return { ...state, auth: { ...state.auth, name: action.value, firstName } };
    }

    case 'ADDRESS_SAVED':
      return { ...state, addressSaved: true };

    case 'TRAINING_PLAN_UPDATED':
      return state.trainingPlan ? { ...state, trainingPlan: { ...state.trainingPlan, ...action.patch } } : state;

    case 'JOIN_EVENT_TOGGLE':
      return { ...state, joinedEvent: !state.joinedEvent };

    default:
      return state;
  }
}
