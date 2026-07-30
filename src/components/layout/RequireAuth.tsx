import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../../state/AppContext';

/** In production this should check a real session/token, not in-memory
 * state — swap the condition here once auth is backed by an API. */
export function RequireAuth() {
  const { state } = useApp();
  if (!state.isAuthenticated) return <Navigate to="/signin" replace />;
  return <Outlet />;
}
