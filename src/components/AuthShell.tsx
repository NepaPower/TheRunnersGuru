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
        <span className="rg-auth-brand-sun" aria-hidden="true" />
        <svg
          className="rg-auth-brand-mark"
          viewBox="0 0 400 300"
          preserveAspectRatio="xMidYMax slice"
          fill="none"
          aria-hidden="true"
        >
          <polygon
            points="0,300 0,190 50,138 96,186 150,106 212,192 262,150 322,204 362,164 400,196 400,300"
            fill="currentColor"
            opacity="0.09"
          />
          <polygon
            points="0,300 0,238 68,168 122,218 192,136 252,226 312,184 400,244 400,300"
            fill="currentColor"
            opacity="0.15"
          />
          <path
            d="M372 296 C330 276 296 262 258 240 S204 196 192 140"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="2 9"
            opacity="0.5"
          />
          <circle cx="192" cy="136" r="5" fill="currentColor" opacity="0.6" />
        </svg>
      </aside>
      <main className="rg-auth-main">{children}</main>
    </div>
  );
}
