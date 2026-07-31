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
