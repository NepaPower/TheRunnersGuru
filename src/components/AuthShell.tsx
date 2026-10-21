import React from 'react';
import { Link } from 'react-router-dom';
import { LogoMark } from './Logo';

/** Two-panel layout for Sign in / Sign up: a dark brand panel (logo, a
 * mountain scene, small label, headline, one-line promise) beside the form.
 * On phones the panel shrinks to a short banner above the form, with the
 * scene as a faint backdrop. Styled in auth.css. */
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
          <LogoMark size={44} />
          The Runners Guru
        </Link>
        <div className="rg-auth-brand-scene" aria-hidden="true">
          <span className="rg-auth-brand-sun" />
          <svg
            className="rg-auth-brand-mark"
            viewBox="0 0 400 260"
            preserveAspectRatio="xMidYMax slice"
            fill="none"
          >
            <polygon
              points="0,260 0,190 36,154 70,190 110,130 160,194 196,166 240,206 282,158 332,202 372,176 400,198 400,260"
              fill="currentColor"
              opacity="0.1"
            />
            <polygon
              points="0,260 0,216 58,166 104,206 168,116 232,216 292,184 350,220 400,200 400,260"
              fill="currentColor"
              opacity="0.17"
            />
            <path
              d="M20 260 C66 244 98 222 124 192 S158 146 168 120"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="2 8"
              opacity="0.6"
            />
            <circle cx="168" cy="116" r="5.5" fill="currentColor" opacity="0.7" />
          </svg>
        </div>
        <div className="rg-auth-brand-copy">
          <div className="rg-auth-brand-eyebrow">{eyebrow}</div>
          <h1 className="rg-auth-brand-headline">{headline}</h1>
          <p className="rg-auth-brand-blurb">{blurb}</p>
        </div>
      </aside>
      <main className="rg-auth-main">{children}</main>
    </div>
  );
}
