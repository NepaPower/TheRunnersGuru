import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogoMark } from '../components/Logo';
import { SUPPORT_EMAIL } from '../data/constants';
// Terms and Privacy are twin legal pages: they share one stylesheet.
import './privacy.css';

const LAST_UPDATED = 'October 21, 2026';

/** Public page (no sign-in): the ground rules for using The Runners Guru.
 * Written in plain English to sit next to the Privacy page. If the app starts
 * charging, collecting new kinds of content, or changes how plans are
 * generated or shared, this needs a matching line. */
export function Terms() {
  const { hash } = useLocation();

  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash]);

  return (
    <div className="rg-pv">
      <nav className="rg-pv-nav">
        <Link to="/" className="rg-pv-brand">
          <LogoMark size={30} />
          The Runners Guru
        </Link>
        <Link to="/signin" className="rg-pv-nav-link">
          Sign in
        </Link>
      </nav>

      <header className="rg-pv-hero">
        <div className="rg-pv-hero-inner">
          <div className="rg-pv-eyebrow">Terms</div>
          <h1>The ground rules.</h1>
          <p>
            A short, plain-English agreement for using The Runners Guru. By creating an account or using the app, you agree
            to it.
          </p>
        </div>
      </header>

      <main className="rg-pv-body">
        <article className="rg-pv-card">
          <p className="rg-pv-updated">Last updated {LAST_UPDATED}</p>

          <h2>The short version</h2>
          <ul>
            <li>The Runners Guru is a planning tool. It is not a coach, a doctor, or a race official.</li>
            <li>
              Check anything that matters on race day, especially cutoff times and aid-station details, with the race
              organizer.
            </li>
            <li>The app is free while we are in beta, and it may change or have rough edges.</li>
            <li>You keep ownership of your runs and your plans.</li>
          </ul>

          <h2>Using the app</h2>
          <ul>
            <li>You must be at least 13 years old.</li>
            <li>Give accurate information when you sign up, and keep your password to yourself.</li>
            <li>You are responsible for what happens under your account.</li>
            <li>Use the app for your own training and crew planning, and treat other runners the way you'd want to be treated.</li>
          </ul>

          <h2>Training and race plans are guidance</h2>
          <p>
            Training plans, paces, aid-station arrival times, cutoff math, and weather are estimates built from the
            information you give us and from course files and forecasts we don't control. Course files can be wrong, a
            forecast can miss, and your day can go differently than any plan.
          </p>
          <ul>
            <li>
              <strong>Not medical advice.</strong> Talk to a doctor before starting or changing a training program,
              especially for a long ultra, and stop if something feels wrong.
            </li>
            <li>
              <strong>Verify the race.</strong> The race organizer's published rules, cutoffs, and course are the final
              word. If the app disagrees with them, go with the organizer.
            </li>
            <li>
              <strong>You decide.</strong> You run, and you choose what to follow, at your own risk. A plan from the app
              does not guarantee a finish, a time, or a safe race.
            </li>
          </ul>

          <h2>Your content</h2>
          <p>
            Your runs, races, notes, GPX files, and images stay yours. By adding them, you let us store them and show them
            where the app is built to show them: to you, and to the crew you invite.
          </p>
          <ul>
            <li>
              <strong>Route Library:</strong> a route you share is visible to other signed-in runners, with your name on
              it. Only share routes you have the right to share, and nothing that exposes someone's home or private
              property. You can delete a route you shared at any time.
            </li>
            <li>
              <strong>Your crew:</strong> when you invite someone to a Crew Plan, you are choosing to let them see it.
              Regular crew can only view it, and a Chief Crew member can edit it.
            </li>
          </ul>

          <h2>What not to do</h2>
          <ul>
            <li>Don't try to see or change other people's data, or get around how the app protects it.</li>
            <li>Don't scrape the app, overload it, or use it to send spam.</li>
            <li>Don't upload anything unlawful, abusive, or that you don't have the right to share.</li>
          </ul>

          <h2>It's a beta</h2>
          <p>
            The Runners Guru is free right now and still being built. Features can change or go away, there may be
            bugs, and we can't promise it will always be available. Before race day, print your crew sheet or save the plan
            for offline, and keep your own copy of anything you can't afford to lose.
          </p>
          <p>If we ever add paid features, we will tell you first.</p>

          <h2>No warranty, and limits on our responsibility</h2>
          <p>
            The app is provided "as is" and "as available". To the fullest extent the law allows, we aren't responsible for
            injuries, illness, missed cutoffs, did-not-finish results, lost data, or other losses that come from using the
            app or relying on a plan, an estimate, or a forecast. Nothing here limits any rights you have by law that can't
            be waived.
          </p>

          <h2>Ending things</h2>
          <p>
            You can stop using the app whenever you like, and you can ask us to delete your account (see the{' '}
            <Link to="/privacy">Privacy page</Link>). We may suspend an account that breaks these rules or puts others at
            risk.
          </p>

          <h2>Changes</h2>
          <p>
            If we change these terms, we'll update this page and the date at the top. If a change matters, we'll tell you in
            the app. Using the app after a change means you accept it.
          </p>

          <h2 id="contact">Contact</h2>
          <p>
            Questions about these terms:
            {SUPPORT_EMAIL ? (
              <>
                {' '}
                email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                {', or use '}
              </>
            ) : (
              ' use '
            )}
            <strong>Send feedback</strong> at the bottom of any screen when you are signed in.
          </p>
        </article>
      </main>

      <footer className="rg-pv-footer">
        <Link to="/">The Runners Guru</Link>
        <span>
          <Link to="/privacy">Privacy</Link> · © 2026 The Runners Guru
        </span>
      </footer>
    </div>
  );
}
