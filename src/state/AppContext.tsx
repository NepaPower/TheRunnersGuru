import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import type { AppState } from '../types';
import type { Action } from './actions';
import { buildInitialState, reducer } from './reducer';
import { fetchTemperatureForZipAndDate } from './../lib/weather';
import { supabase } from '../lib/supabaseClient';
import { hydrateUserData } from '../lib/api';
import { updateLoggedRunTemperature } from '../lib/api';
import { cacheGet, cacheSet } from '../lib/offlineCache';

type HydratedUserData = Awaited<ReturnType<typeof hydrateUserData>>;

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
    // Online path: fetch fresh, hydrate, and stash a copy in IndexedDB so
    // a later offline open has something to show.
    async function hydrateFromSession(userId: string) {
      const hydrated = await hydrateUserData(userId);
      dispatch({ type: 'AUTH_HYDRATE', userId, ...hydrated });
      cacheSet<HydratedUserData>(`user:${userId}`, hydrated);
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
