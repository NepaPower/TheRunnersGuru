import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogoMark } from '../components/Logo';
import { useApp } from '../state/AppContext';
import { WHATS_NEW, markWhatsNewSeen, seenWhatsNewId } from '../data/whatsNew';
// Same look as the Privacy and Terms pages, so they share one stylesheet.
import './privacy.css';

const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/** Public page: what has changed in the app, newest first. Entries newer than what
 * this browser last saw carry a "New" tag; opening the page marks them seen. */
export function WhatsNew() {
  const { state } = useApp();
  const signedIn = !!state.userId;
  // Read what was seen BEFORE marking it, so this visit still shows which entries are new.
  const [seenBefore] = useState(seenWhatsNewId);

  useEffect(() => {
    window.scrollTo(0, 0);
    markWhatsNewSeen();
  }, []);

  return (
    <div className="rg-pv">
      <nav className="rg-pv-nav">
        <Link to={signedIn ? '/home' : '/'} className="rg-pv-brand">
          <LogoMark size={30} />
          The Runners Guru
        </Link>
        <Link to={signedIn ? '/home' : '/signin'} className="rg-pv-nav-link">
          {signedIn ? 'Back to app' : 'Sign in'}
        </Link>
      </nav>

      <header className="rg-pv-hero">
        <div className="rg-pv-hero-inner">
          <div className="rg-pv-eyebrow">What's new</div>
          <h1>Always getting better.</h1>
          <p>The latest changes to The Runners Guru, newest first. Something you'd like to see next? Use Send feedback in the app.</p>
        </div>
      </header>

      <main className="rg-pv-body">
        <article className="rg-pv-card">
          {WHATS_NEW.map((entry, i) => (
            <section key={entry.id}>
              <h2 style={i === 0 ? { marginTop: 0, paddingTop: 0, borderTop: 'none' } : undefined}>
                {entry.title}
                {entry.id > seenBefore && <span className="rg-wn-new">New</span>}
              </h2>
              <p className="rg-pv-updated">{formatDate(entry.id)}</p>
              <ul>
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      </main>

      <footer className="rg-pv-footer">
        <Link to="/">The Runners Guru</Link>
        <span>
          <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · © 2026 The Runners Guru
        </span>
      </footer>
    </div>
  );
}
