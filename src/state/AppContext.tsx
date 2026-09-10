import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import type { AppState, TrainingPlan } from '../types';
import type { Action } from './actions';
import { buildInitialState, reducer } from './reducer';
import { fetchTemperatureForZipAndDate } from './../lib/weather';
import { supabase } from '../lib/supabaseClient';
import { hydrateUserData } from '../lib/api';
import { updateLoggedRunTemperature } from '../lib/api';
import { cacheGet, cacheSet } from '../lib/offlineCache';

// `hydrateUserData` can actually return a null trainingPlan at runtime
// (a user with no races) even though its inferred type doesn't say so.
type HydratedUserData = Omit<Awaited<ReturnType<typeof hydrateUserData>>, 'trainingPlan'> & {
  trainingPlan: TrainingPlan | null;
};

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  authReady: boolean; // false until the initial session check has completed
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const [authReady, setAuthReady] = React.useState(false);
  const timerRef = useRef<number | null>(null);

  // On first load, and whenever Supabase's auth state changes (sign-in,
  // sign-out, token refresh), pull the user's data and hydrate local state.
  useEffect(() => {
    // Online path: fetch fresh and hydrate. The snapshot-sync effect below
    // then mirrors this (and every later edit) into IndexedDB.
    async function hydrateFromSession(userId: string) {
      const hydrated = await hydrateUserData(userId);
      dispatch({ type: 'AUTH_HYDRATE', userId, ...hydrated });
    }

    // Offline (or fetch-failed) path: if this browser has a valid session
    // but we can't reach Supabase, boot from the last cached snapshot
    // instead of bouncing a signed-in person to /signin. `dataStale` marks
    // the app as running on a saved copy.
    async function hydrateFromCache(userId: string): Promise<boolean> {
      const snap = await cacheGet<HydratedUserData>(`user:${userId}`);
      if (!snap) return false;
      dispatch({ type: 'AUTH_HYDRATE', userId, ...snap.value, dataStale: true, dataCachedAt: snap.cachedAt });
      return true;
    }

    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id;
      if (!userId) {
        setAuthReady(true);
        return;
      }
      hydrateFromSession(userId)
        .catch(() => hydrateFromCache(userId))
        .finally(() => setAuthReady(true));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user.id) {
        hydrateFromSession(session.user.id).catch(() => {});
      }
      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'LOGOUT' });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Run-tracking timer: purely a client-side simulation (not real GPS),
  // ticking once a second while a run is active.
  useEffect(() => {
    if (state.run.active && timerRef.current == null) {
      timerRef.current = window.setInterval(() => dispatch({ type: 'RUN_TICK' }), 1000);
    }
    if (!state.run.active && timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.run.active]);

  // Offline support (step 3): keep the IndexedDB snapshot in step with
  // live state, so an offline reload after some edits shows the edited
  // plan — not whatever was cached at the last full page load. Skipped
  // while `dataStale` (we booted FROM the cache and can't reach the
  // server, so state has nothing newer to write).
  useEffect(() => {
    if (!state.userId || state.dataStale) return;
    const snapshot: HydratedUserData = {
      name: state.auth.name,
      address: state.auth.address,
      garminConnected: state.garminConnected,
      trainingPlan: state.trainingPlan,
      ownPlans: state.ownPlans,
      loggedRuns: state.loggedRuns,
      sharedPlans: state.sharedPlans,
      email: state.auth.email,
    };
    cacheSet<HydratedUserData>(`user:${state.userId}`, snapshot);
  }, [
    state.userId,
    state.dataStale,
    state.auth.name,
    state.auth.address,
    state.auth.email,
    state.garminConnected,
    state.trainingPlan,
    state.ownPlans,
    state.loggedRuns,
    state.sharedPlans,
  ]);

  // Whenever a logged run is waiting on a weather lookup ("Looking up…"),
  // resolve it against Open-Meteo and write the result back to Supabase.
  useEffect(() => {
    const pending = state.loggedRuns.filter((r) => r.temperature === 'Looking up…');
    if (pending.length === 0) return;
    const zip = state.auth.address.zip.trim();
    pending.forEach((entry) => {
      fetchTemperatureForZipAndDate(zip, entry.date).then(async (label) => {
        await updateLoggedRunTemperature(entry.id, label);
        dispatch({ type: 'LOG_RUN_SET_TEMP', id: entry.id, label });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loggedRuns]);

  return <AppContext.Provider value={{ state, dispatch, authReady }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
}
