import type { AppState, LoggedRun } from '../types';
import type { Action } from './actions';
import { SEED_MATCHES } from '../data/constants';
import { buildTrainingPlan } from '../lib/planGenerator';
import { formatDurationParts, paceLabelFromMinutes } from '../lib/format';
import { mockTemperature } from '../lib/weather';
import { saveLoggedRuns } from '../lib/storage';
import { RACES_BY_DISTANCE } from '../data/constants';

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

export function buildInitialState(loggedRuns: LoggedRun[]): AppState {
  return {
    screen: 'landing',
    isAuthenticated: false,
    auth: {
      name: '',
      firstName: '',
      email: '',
      address: { street: '', unit: '', city: '', state: '', zip: '', phone: '' },
    },
    onboarding: {
      step: 0,
      distanceGoal: '',
      distanceEditing: false,
      raceChoice: '',
      raceName: '',
      raceAddress: '',
      firstTime: '',
      pace: '',
      paceUnit: 'mi',
      customPace: '',
      raceDate: '',
      goalHours: '',
      goalMinutes: '',
    },
    trainingPlan: null,
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
    loggedRuns,
    joinedEvent: false,
    addressSaved: false,
  };
}

function formatAddress(address: AppState['auth']['address']): string {
  const parts = [
    [address.street, address.unit].filter(Boolean).join(' '),
    address.city,
    [address.state, address.zip].filter(Boolean).join(' '),
  ].filter(Boolean);
  return parts.join(', ');
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.screen };

    case 'SIGNUP_SUBMIT': {
      const firstName = action.name.trim().split(' ')[0] || 'Runner';
      return {
        ...state,
        screen: 'onboarding',
        isAuthenticated: true,
        auth: { ...state.auth, name: action.name, firstName, address: action.address },
        onboarding: { ...state.onboarding, step: 0, raceAddress: formatAddress(action.address) },
      };
    }

    case 'SIGNIN_SUBMIT': {
      // Returning user: if a plan already exists this session, skip straight
      // to the dashboard. Otherwise seed sensible demo defaults so the
      // dashboard isn't empty (in production: fetch the user's stored plan).
      if (state.trainingPlan) {
        return { ...state, screen: 'home', isAuthenticated: true };
      }
      const defaultRaceDate = new Date();
      defaultRaceDate.setMonth(defaultRaceDate.getMonth() + 4);
      const distanceGoal = state.onboarding.distanceGoal || 'full';
      const raceDate = state.onboarding.raceDate || defaultRaceDate.toISOString().slice(0, 10);
      const firstTime = state.onboarding.firstTime || 'no';
      const raceName = state.onboarding.raceName || 'Marine Corps Marathon';
      return {
        ...state,
        screen: 'home',
        isAuthenticated: true,
        auth: { ...state.auth, firstName: state.auth.firstName || 'Ramesh' },
        onboarding: {
          ...state.onboarding,
          distanceGoal,
          raceDate,
          firstTime,
          pace: state.onboarding.pace || 'steady',
          raceName,
        },
        trainingPlan: buildTrainingPlan(raceDate, distanceGoal, firstTime, raceName),
      };
    }

    case 'LOGOUT':
      // Logged-run history persists (localStorage); everything else in this
      // in-memory session resets, matching the prototype. A real app must
      // persist all of this server-side per account instead.
      return { ...buildInitialState(state.loggedRuns), screen: 'landing' };

    case 'ONBOARDING_SELECT_DISTANCE':
      return {
        ...state,
        onboarding: { ...state.onboarding, distanceGoal: action.id, raceChoice: '', raceName: '', distanceEditing: false },
      };

    case 'ONBOARDING_EDIT_DISTANCE':
      return { ...state, onboarding: { ...state.onboarding, distanceEditing: true } };

    case 'ONBOARDING_SET_RACE_CHOICE':
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          raceChoice: action.value,
          raceName: action.value === '__other__' ? '' : action.value,
        },
      };

    case 'ONBOARDING_SET_RACE_NAME':
      return { ...state, onboarding: { ...state.onboarding, raceName: action.value } };

    case 'ONBOARDING_SET_RACE_ADDRESS':
      return {
        ...state,
        onboarding: { ...state.onboarding, raceAddress: action.value, raceChoice: '', raceName: '' },
      };

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
      if (state.onboarding.step < 3) {
        return { ...state, onboarding: { ...state.onboarding, step: (state.onboarding.step + 1) as 0 | 1 | 2 | 3 } };
      }
      // Final step: generate the plan ONCE. Never regenerate on later visits.
      const plan =
        state.trainingPlan ??
        buildTrainingPlan(
          state.onboarding.raceDate,
          state.onboarding.distanceGoal || '5k',
          state.onboarding.firstTime,
          state.onboarding.raceName,
        );
      return { ...state, screen: 'home', trainingPlan: plan };
    }

    case 'ONBOARDING_PREV':
      if (state.onboarding.step === 0) return state;
      return { ...state, onboarding: { ...state.onboarding, step: (state.onboarding.step - 1) as 0 | 1 | 2 | 3 } };

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

    case 'LOG_RUN_ADD': {
      const f = state.logForm;
      const d = Number(f.days), h = Number(f.hours), m = Number(f.minutes), sec = Number(f.seconds);
      const totalMinutes = d * 24 * 60 + h * 60 + m + sec / 60;
      const miles = parseFloat(f.distance) || 0;
      const paceLabel = paceLabelFromMinutes(totalMinutes, miles);
      const duration = formatDurationParts(d, h, m, sec);
      const entryId = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const zip = state.auth.address.zip.trim();
      const manualTemp = f.temperature !== '' ? Math.abs(Math.round(Number(f.temperature))) : null;

      const newEntry: LoggedRun = {
        id: entryId,
        date: f.date,
        distance: f.distance,
        duration,
        timeOfDay: f.timeOfDay,
        paceLabel,
        temperature:
          manualTemp != null ? `${manualTemp}°F` : zip ? 'Looking up…' : `${mockTemperature(f.date, f.timeOfDay)}°F`,
        electrolytes:
          Number(f.electrolytesCount) > 0 && f.electrolytesBrand ? `${f.electrolytesCount}x ${f.electrolytesBrand}` : '—',
        nutrition: Number(f.nutritionCount) > 0 && f.nutritionBrand ? `${f.nutritionCount}x ${f.nutritionBrand}` : '—',
        comment: f.comment,
      };
      const updatedRuns = [newEntry, ...state.loggedRuns];
      saveLoggedRuns(updatedRuns);
      return { ...state, loggedRuns: updatedRuns, logForm: { ...emptyLogForm } };
    }

    case 'LOG_RUN_SET_TEMP': {
      const loggedRuns = state.loggedRuns.map((r) => (r.id === action.id ? { ...r, temperature: action.label } : r));
      saveLoggedRuns(loggedRuns);
      return { ...state, loggedRuns };
    }

    case 'ADDRESS_FIELD_CHANGE':
      return { ...state, auth: { ...state.auth, address: { ...state.auth.address, [action.field]: action.value } } };

    case 'ADDRESS_SAVE':
      return {
        ...state,
        onboarding: { ...state.onboarding, raceAddress: formatAddress(state.auth.address) },
        addressSaved: true,
      };

    case 'JOIN_EVENT_TOGGLE':
      return { ...state, joinedEvent: !state.joinedEvent };

    case 'LOGGED_RUNS_LOADED':
      return { ...state, loggedRuns: action.runs };

    default:
      return state;
  }
}

/** Mocked "races within 40 miles" lookup for onboarding step 1 — a real
 * backend would replace this with an actual race-finder API. */
export function nearbyRaces(distanceGoal: AppState['onboarding']['distanceGoal']) {
  if (!distanceGoal) return [];
  return (RACES_BY_DISTANCE[distanceGoal] || []).filter((r) => r.miles <= 40);
}
