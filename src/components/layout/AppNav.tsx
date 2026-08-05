import { useState } from 'react';
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
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    // AppContext's onAuthStateChange listener dispatches LOGOUT once
    // Supabase confirms the session is gone — no manual dispatch needed here.
    await signOut();
    navigate('/');
  }

  return (
    <nav className="nav" style={{ borderBottom: '1px solid var(--color-divider)' }}>
      <div className="nav-brand">
        <Wordmark fontSize={32} />
      </div>

      <div className="nav-links">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            {({ isActive }) => <span style={{ color: isActive ? 'var(--color-accent)' : undefined }}>{item.label}</span>}
          </NavLink>
        ))}
        <Button variant="ghost" className="nav-cta" onClick={handleLogout}>
          Log out
        </Button>
      </div>

      <button
        type="button"
        className="nav-hamburger"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path d="M6 6l12 12M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path d="M4 7h16M4 12h16M4 17h16" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {mobileOpen && (
        <div className="nav-mobile-menu">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <Button
            variant="secondary"
            block
            onClick={() => {
              setMobileOpen(false);
              handleLogout();
            }}
          >
            Log out
          </Button>
        </div>
      )}
    </nav>
  );
}
