import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import type { AppState } from '../types';
import type { Action } from './actions';
import { buildInitialState, reducer } from './reducer';
import { loadLoggedRuns } from '../lib/storage';
import { fetchTemperatureForZipAndDate } from '../lib/weather';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => buildInitialState(loadLoggedRuns()));
  const timerRef = useRef<number | null>(null);

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
  // resolve it against Open-Meteo and write the result back.
  useEffect(() => {
    const pending = state.loggedRuns.filter((r) => r.temperature === 'Looking up…');
    if (pending.length === 0) return;
    const zip = state.auth.address.zip.trim();
    pending.forEach((entry) => {
      fetchTemperatureForZipAndDate(zip, entry.date).then((label) => {
        dispatch({ type: 'LOG_RUN_SET_TEMP', id: entry.id, label });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loggedRuns]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
}
