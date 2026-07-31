import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../../state/AppContext';

export function RequireAuth() {
  const { state, authReady } = useApp();

  // Wait for the initial Supabase session check before deciding — without
  // this, a real logged-in user briefly flashes a redirect to /signin on
  // every hard refresh, since the async getSession() call hasn't resolved yet.
  if (!authReady) {
    return (
      <div className="centered-card-page">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (!state.isAuthenticated) return <Navigate to="/signin" replace />;
  return <Outlet />;
}
