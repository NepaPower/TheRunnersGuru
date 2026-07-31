export function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <path
        d="M3 22L11 8L16 17L19 12L27 22"
        stroke="var(--color-accent-600)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="22" cy="7" r="3" fill="var(--color-accent-2-500)" />
    </svg>
  );
}

export function Wordmark({ fontSize = 32 }: { fontSize?: number }) {
  return (
    <div className="row-3" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize }}>
      <LogoMark size={fontSize + 6} />
      The Runners Guru
    </div>
  );
}

/** For standalone pages that sit outside the main app nav (Sign In, Sign
 * Up, Onboarding) — a small clickable brand mark so those screens don't
 * feel disconnected from the rest of the product. Links to the marketing
 * page when signed out, since none of these screens have a "home" to
 * return to yet. */
export function BrandHeader() {
  return (
    <a
      href="/"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--font-heading)',
        fontWeight: 600,
        fontSize: 20,
        color: 'var(--color-text)',
        textDecoration: 'none',
        marginBottom: 'var(--space-6)',
      }}
    >
      <LogoMark size={28} />
      The Runners Guru
    </a>
  );
}
