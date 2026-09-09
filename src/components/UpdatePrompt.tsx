import { useRegisterSW } from 'virtual:pwa-register/react';

/** Service-worker update toast. With `registerType: 'prompt'` a new build
 * is downloaded but not activated until the user asks — so someone using
 * the app mid-race is never yanked onto a different bundle. Shows a small
 * dismissible bar; "Refresh" swaps to the new version and reloads.
 *
 * Inline styles (no dedicated .css) to match the other standalone widgets
 * — Logo, WeeklyMileageChart. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div role="status" aria-live="polite" style={wrap}>
      <span style={{ flex: 1 }}>A new version of The Runners Guru is available.</span>
      <button type="button" style={refreshBtn} onClick={() => updateServiceWorker(true)}>
        Refresh
      </button>
      <button type="button" aria-label="Dismiss" style={dismissBtn} onClick={() => setNeedRefresh(false)}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'var(--space-6)',
  transform: 'translateX(-50%)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  width: 'min(520px, calc(100vw - 2 * var(--space-4)))',
  padding: 'var(--space-3) var(--space-4)',
  background: 'var(--color-neutral-900)',
  color: '#fff',
  border: '1px solid var(--color-divider)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.28)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
};

const refreshBtn: React.CSSProperties = {
  flex: 'none',
  padding: '6px 14px',
  background: 'var(--color-accent-600)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-heading)',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
};

const dismissBtn: React.CSSProperties = {
  flex: 'none',
  display: 'grid',
  placeItems: 'center',
  width: 26,
  height: 26,
  background: 'transparent',
  color: 'var(--color-neutral-400)',
  border: 'none',
  cursor: 'pointer',
};
