import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../../state/AppContext';

/** Sits inside RequireAuth (and AppLayout), wrapping the main app screens
 * (Dashboard, Training Plan, etc.) — if a signed-in user somehow lands
 * here without a saved training plan (direct link, bookmark, browser
 * back button, or a nav click from a crew-only user with no race of
 * their own), send them somewhere useful instead of showing an empty
 * dashboard: Shared Plans if they've been invited to crew for someone
 * else, otherwise onboarding. Same rule SignIn.tsx already applies right
 * after sign-in — this just makes it hold for in-app navigation too. */
export function RequirePlan() {
  const { state } = useApp();
  if (!state.trainingPlan) {
    return <Navigate to={state.sharedPlans.length > 0 ? '/shared-plans' : '/onboarding'} replace />;
  }
  return <Outlet />;
}
