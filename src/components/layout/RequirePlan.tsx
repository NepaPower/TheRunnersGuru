import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../../state/AppContext';

/** Sits inside RequireAuth, wrapping the main app screens (Dashboard,
 * Training Plan, etc.) — if a signed-in user somehow lands here without a
 * saved training plan (direct link, bookmark, browser back button), send
 * them to finish onboarding instead of showing an empty dashboard. */
export function RequirePlan() {
  const { state } = useApp();
  if (!state.trainingPlan) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
