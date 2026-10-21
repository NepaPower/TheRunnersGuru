import React from 'react';
import { Link } from 'react-router-dom';
import { LogoMark } from './Logo';

/** Two-panel layout for Sign in / Sign up: a dark brand panel (logo, small
 * label, headline, one-line promise) beside the form. On phones the panel
 * shrinks to a short banner above the form. Styled in auth.css. */
export function AuthShell({
  eyebrow,
  headline,
  blurb,
  children,
}: {
  eyebrow: string;
  headline: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rg-auth-split">
      <aside className="rg-auth-brand">
        <Link to="/" className="rg-auth-brand-logo">
          <LogoMark size={32} />
          The Runners Guru
        </Link>
        <div className="rg-auth-brand-copy">
          <div className="rg-auth-brand-eyebrow">{eyebrow}</div>
          <h1 className="rg-auth-brand-headline">{headline}</h1>
          <p className="rg-auth-brand-blurb">{blurb}</p>
        </div>
        <svg className="rg-auth-brand-mark" viewBox="0 0 30 30" fill="none" aria-hidden="true">
          <path d="M3 22L11 8L16 17L19 12L27 22" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="22" cy="7" r="2.2" fill="currentColor" />
        </svg>
      </aside>
      <main className="rg-auth-main">{children}</main>
    </div>
  );
}
