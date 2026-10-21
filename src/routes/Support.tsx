import { PageHeader } from '../components/PageHeader';
import { SUPPORT_URL } from '../data/constants';
import './support.css';

/** "Support the Guru": a low-key page for people who want to back the app while
 * it's free. Payments aren't wired up yet, so the main button only becomes a
 * real link once SUPPORT_URL (src/data/constants.ts) is set to a payment page;
 * until then it says so plainly instead of pretending. Deliberately makes no
 * promise about where money goes or about tax treatment. */
export function Support() {
  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Support the Guru"
        insight="Free while we're in beta."
        subtitle="The Runners Guru is built by one runner for runners and their crews."
      />

      <div className="rg-su-card">
        <div className="rg-su-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1l1.7 1.7L12 21.5l7.1-7.1 1.7-1.7a5 5 0 0 0 0-7.1Z" />
          </svg>
        </div>
        <h3>Everything in the app is free right now.</h3>
        <p>
          Training plans, crew plans, cutoff math, the Route Library: none of it costs anything, and the basics will stay
          free. If The Runners Guru has helped your training or your crew, you can help keep it going and growing.
        </p>

        {SUPPORT_URL ? (
          <a className="btn btn-primary rg-su-btn" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Support the Guru →
          </a>
        ) : (
          <>
            <button type="button" className="btn btn-primary rg-su-btn" disabled>
              Support the Guru
            </button>
            <p className="rg-su-note">Not switched on yet. We'll tell you right here when it is.</p>
          </>
        )}
      </div>

      <div className="rg-su-card rg-su-ask">
        <h3>Help us decide what to build</h3>
        <p>
          Later on, extras for race week may be offered as an optional paid pass: a printable crew sheet, pacing adjusted
          for heat and climbs, live updates for your crew. Which of those would you actually use? Tell us with{' '}
          <strong>Send feedback</strong> at the bottom of any screen.
        </p>
      </div>
    </>
  );
}
