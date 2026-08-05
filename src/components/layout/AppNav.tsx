import { NavLink, useNavigate } from 'react-router-dom';
import { Wordmark } from '../Logo';
import { Button } from '../ui/Button';
import { signOut } from '../../lib/api';

const NAV_ITEMS = [
  {
    to: '/home',
    label: 'Home',
    icon: <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  },
  {
    to: '/partners',
    label: 'Partners',
    icon: (
      <>
        <circle cx="9" cy="8" r="3" strokeWidth="2" fill="none" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="17" cy="8" r="2.5" strokeWidth="2" fill="none" />
        <path d="M15.5 14.3c2.6.4 4.5 2.7 4.5 5.7" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    to: '/run',
    label: 'Run',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" strokeWidth="2" fill="none" />
        <path d="M12 7v5l3.5 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
  {
    to: '/chat',
    label: 'Chat',
    icon: <path d="M4 5h16v11H8l-4 4V5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" strokeWidth="2" fill="none" />
        <path d="M4.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
  },
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
    <>
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
      </nav>

      {/* Bottom tab bar — the mobile nav pattern for a daily-use training
          app (persistent, always-visible destinations) rather than a
          hamburger menu, which suits content/marketing sites better than
          something people open every day. Hidden above the phone
          breakpoint via CSS; .nav-links above is hidden below it. */}
      <nav className="bottom-tab-bar" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-tab${isActive ? ' active' : ''}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              {item.icon}
            </svg>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
