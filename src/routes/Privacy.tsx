import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogoMark } from '../components/Logo';
import { SUPPORT_EMAIL } from '../data/constants';
import './privacy.css';

const LAST_UPDATED = 'October 20, 2026';

/** Public page (no sign-in): what The Runners Guru collects, who sees it,
 * and which outside services it talks to. Keep this in step with the app —
 * if a feature starts collecting something new, or calls a new service, the
 * matching section below needs a line. */
export function Privacy() {
  const { hash } = useLocation();

  // Router doesn't scroll for us: honor "#contact" links, else start at the top.
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
          <div className="rg-pv-eyebrow">Privacy</div>
          <h1>Your runs are yours.</h1>
          <p>
            Here is what The Runners Guru keeps, who can see it, and which other services it talks to. Plain English, no
            fine print.
          </p>
        </div>
      </header>

      <main className="rg-pv-body">
        <article className="rg-pv-card">
          <p className="rg-pv-updated">Last updated {LAST_UPDATED}</p>

          <h2>The short version</h2>
          <ul>
            <li>We collect only what the app needs to plan your training and your race day.</li>
            <li>We never sell your information, and there are no ads or tracking scripts in the app.</li>
            <li>Your profile, runs, and plans are private to you. The only people who see a plan are the crew you invite.</li>
            <li>A route you share to the Route Library is visible to other signed-in runners, with your name on it.</li>
          </ul>

          <h2>What we collect</h2>
          <h3>Your account</h3>
          <p>
            Your name, email address, and password. Your password is handled by our sign-in provider and stored in hashed
            form, so we never see it.
          </p>
          <h3>Your profile</h3>
          <p>
            Street address, apartment or suite, city, state, and zip code, plus an optional phone number. Your zip code is
            required: we use it to find races and weather near you.
          </p>
          <h3>Your training and races</h3>
          <p>
            The races you add (name, date, distance, location), your goal time and fitness answers, your generated training
            plan, and everything you put in a Crew Plan: aid-station notes, cutoffs, pace and rest times, your course GPX
            file, and any gear or segment images you upload.
          </p>
          <h3>Your run log</h3>
          <p>
            Each run you log: date, distance, time, notes, and optional details such as nutrition. If you import a GPX
            file, we also keep the route shape and any heart rate, cadence, and elevation data it contains.
          </p>
          <h3>Crew invitations</h3>
          <p>
            The email addresses of people you invite to your Crew Plan, and their role (crew or Chief Crew). If someone
            invites you, we match the invitation to your account by email.
          </p>
          <h3>Routes you share</h3>
          <p>
            If you share a GPX route to the Route Library: its title, description, location, the file itself, and your
            name as the uploader.
          </p>
          <h3>Feedback you send</h3>
          <p>
            Your message, the category you pick, the page you were on, your browser type, and your name and email so we
            can reply.
          </p>

          <h2>Who can see it</h2>
          <ul>
            <li>
              <strong>Only you:</strong> your profile, run log, training plan, and the races you add. This is enforced in
              our database, not just hidden in the app.
            </li>
            <li>
              <strong>Your crew:</strong> anyone you invite can open that race's Crew Plan. Regular crew can only view it.
              You and your Chief Crew can edit it. Your crew sees your name and the plan, not your address or run log.
            </li>
            <li>
              <strong>Other signed-in runners:</strong> only the routes you choose to share to the Route Library, along with
              your name.
            </li>
            <li>
              <strong>Us:</strong> we can read what our database holds. We look at it to keep the app working and to read
              your feedback, not to browse your runs.
            </li>
          </ul>

          <h2>Other services the app uses</h2>
          <ul>
            <li>
              <strong>Supabase</strong> hosts our sign-in, database, and file storage. Everything above is stored there.
            </li>
            <li>
              <strong>GitHub Pages</strong> serves the website itself.
            </li>
            <li>
              <strong>Open-Meteo</strong> provides weather and place lookups. When you view weather or search for a race,
              your zip code or the race's location coordinates are sent to it. Your name and account are not.
            </li>
            <li>
              <strong>Google Fonts</strong> supplies the typefaces. Loading them sends your IP address to Google, as with
              any site that uses it.
            </li>
          </ul>
          <p>
            We do not use advertising or analytics services, and nothing is shared with other companies for marketing.
          </p>

          <h2>On your device</h2>
          <p>
            Your browser keeps you signed in, and it saves a copy of your plans, weather, and images so a Crew Plan still
            opens when you lose signal on the trail. That copy lives on your device. Signing out or clearing the site's
            data removes it.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>Update your name, address, and phone any time from Profile.</li>
            <li>Delete a run, a race, or a route you shared from inside the app.</li>
            <li>
              To delete your account and everything attached to it, contact us (below). Deleting an account removes your
              profile, runs, races, and plans, and removes you from other people's crews.
            </li>
          </ul>
          <p>We keep your information for as long as your account exists, and delete it when the account is deleted.</p>

          <h2>Children</h2>
          <p>The Runners Guru is not meant for children under 13, and we don't knowingly collect their information.</p>

          <h2>Changes</h2>
          <p>
            If we change how we handle your information, we will update this page and the date at the top. If a change
            matters, we will tell you in the app.
          </p>

          <h2 id="contact">Contact</h2>
          <p>
            Questions, a request to see or delete your data, or anything else about privacy:
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
        <span>© 2026 The Runners Guru</span>
      </footer>
    </div>
  );
}
