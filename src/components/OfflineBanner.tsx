import { useOnlineStatus } from '../lib/useOnlineStatus';

/**
 * Offline support, step 2: a slim status bar pinned to the top of the
 * viewport whenever the browser reports no connection. Advisory only —
 * it doesn't block anything; screens that can't load their data show
 * their own "you're offline" state (see CrewPlan). Disappears the moment
 * connectivity returns.
 *
 * Inline-styled to match the other standalone widgets (Logo, UpdatePrompt).
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div role="status" aria-live="polite" style={bar}>
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
        <path
          d="M2 2l20 20M8.5 16.5a5 5 0 017 0M5 13a10 10 0 0114 0M1.5 9.5a15 15 0 0121 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span>You're offline. You can read what's already loaded — changes won't save until you reconnect.</span>
    </div>
  );
}

const bar: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '6px 12px',
  background: 'var(--color-neutral-900)',
  color: '#fff',
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  lineHeight: 1.3,
  textAlign: 'center',
};
