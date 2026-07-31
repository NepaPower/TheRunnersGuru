import { NavLink, useNavigate } from 'react-router-dom';
import { Wordmark } from '../Logo';
import { Button } from '../ui/Button';
import { signOut } from '../../lib/api';

const NAV_ITEMS = [
  { to: '/home', label: 'Home' },
  { to: '/partners', label: 'Partners' },
  { to: '/run', label: 'Run' },
  { to: '/chat', label: 'Chat' },
  { to: '/profile', label: 'Profile' },
];

export function AppNav() {
  const navigate = useNavigate();

  async function handleLogout() {
    // AppContext's onAuthStateChange listener dispatches LOGOUT once
    // Supabase confirms the session is gone — no manual dispatch needed here.
    await signOut();
    navigate('/');
  }

  return (
    <nav className="nav" style={{ borderBottom: '1px solid var(--color-divider)' }}>
      <div className="nav-brand">
        <Wordmark fontSize={26} />
      </div>
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          {({ isActive }) => <span style={{ color: isActive ? 'var(--color-accent)' : undefined }}>{item.label}</span>}
        </NavLink>
      ))}
      <Button variant="ghost" className="nav-cta" onClick={handleLogout}>
        Log out
      </Button>
    </nav>
  );
}
