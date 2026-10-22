import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/Logo';
import { Button } from '../components/ui/Button';
import './landing.css';

// Who it's for — each card names a situation, not a feature. Everything
// described here exists in the app today. Icons are hand-drawn glyphs (no
// icon library), tinted by position via CSS.
const AUDIENCES: { title: string; desc: string; icon: JSX.Element }[] = [
  {
    title: 'Your first race',
    desc: 'A week-by-week plan from 5K to marathon, with the pace to run every workout.',
    icon: <path d="M6 21V4M6 4h11l-3 4 3 4H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  },
  {
    title: 'Your next ultra',
    desc: 'Aid-station arrival times, cutoff pace and the weather at every station, built from your course GPX.',
    icon: <path d="M3 20l6-12 4 7 3-5 5 10z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  },
  {
    title: 'Worried about a cutoff',
    desc: 'See the pace you need to make every cutoff, leg by leg, and what you can afford to spend at each stop.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" strokeWidth="2" fill="none" />
        <path d="M12 7v5l3.5 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
  {
    title: 'Crewing someone',
    desc: "Open your runner's plan on your phone: when they arrive, driving directions to each aid station, what to bring.",
    icon: (
      <path
        d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 20v-1a3.5 3.5 0 0 0-2.5-3.36M15.5 3.13a3.5 3.5 0 0 1 0 6.75"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  {
    title: 'Pacing someone',
    desc: 'Know the leg ahead before you join: distance, climb, descent, and where you meet your runner.',
    icon: <path d="M4 12h16M14 6l6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  },
  {
    title: 'Running somewhere new',
    desc: 'Browse and share GPX trails from runners around the world. Local trails, global Guru.',
    icon: (
      <g>
        <circle cx="5" cy="19" r="2" strokeWidth="2" fill="none" />
        <circle cx="19" cy="5" r="2" strokeWidth="2" fill="none" />
        <path d="M7 18c3-2 2-6 5-8s3-5 6-6" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
    ),
  },
];

// The Crew Plan: what the GPX upload turns into. Every line describes something the
// Crew Plan screen really does today.
const CREW_STEPS = [
  { title: 'Upload your GPX', desc: "Course distance, climb and descent, and the aid stations the race organizer named, read straight from the file." },
  { title: 'See every station', desc: 'Mile marker, when you will arrive at your goal pace, and the pace you need to make each cutoff.' },
  { title: 'Check the weather', desc: 'Temperature, rain chance and wind for race day at each station, or typical conditions when it is still far off.' },
  { title: 'Bring your crew', desc: 'Invite them by email. Everyone sees the same plan, and only you and your Chief Crew can change it.' },
];

const CREW_FEATURES: { title: string; desc: string; icon: JSX.Element }[] = [
  {
    title: 'Aid stations, found for you',
    desc: "The organizer's named waypoints in your GPX become aid stations, placed on the course by mile. Fix a mile marker and every time recalculates.",
    icon: (
      <>
        <path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10Z" strokeWidth="2" strokeLinejoin="round" fill="none" />
        <circle cx="12" cy="11" r="2.2" strokeWidth="2" fill="none" />
      </>
    ),
  },
  {
    title: 'Arrival times and cutoffs',
    desc: 'Your goal time and rest stops become the time you reach every station, plus the pace you must hold to make each cutoff, leg by leg.',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" strokeWidth="2" fill="none" />
        <path d="M12 7v5l3.5 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
  {
    title: 'Weather at every station',
    desc: 'Temperature, chance of rain and wind through race day at each aid station, so you and your crew pack for what is really coming.',
    icon: (
      <>
        <circle cx="9" cy="9" r="3" strokeWidth="2" fill="none" />
        <path d="M9 3v1.5M3 9h1.5M4.8 4.8l1 1M13.2 4.8l-1 1" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M8 20h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 13.6 3.2 3.2 0 0 0 8 20Z" strokeWidth="2" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
  {
    title: 'Manage your crew',
    desc: 'Invite crew and pacers by email. Your Chief Crew helps keep the plan current and everyone else follows along: one plan, no group-text confusion.',
    icon: (
      <path
        d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 20v-1a3.5 3.5 0 0 0-2.5-3.36M15.5 3.13a3.5 3.5 0 0 1 0 6.75"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  {
    title: 'Works offline',
    desc: 'Save the plan before you lose signal and it stays readable on the trail, at the aid station and in the car.',
    icon: (
      <>
        <path d="M12 3v11M8 10l4 4 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
  },
  {
    title: 'Everything your crew needs',
    desc: 'Rest and sleep stops, what goes in each drop bag, pacer pickups, a race-wide mandatory gear list, nutrition and hydration notes, driving directions to every station, and a print-ready crew sheet.',
    icon: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" strokeWidth="2" fill="none" />
        <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
  },
];

const STEPS = [
  { label: 'Before', title: 'Train with a plan', desc: 'Built backward from race day, with a target pace for every workout.' },
  { label: 'During', title: 'Race with a plan', desc: 'Your Crew Plan shows when you reach each aid station, and the weather when you get there.' },
  { label: 'All night', title: 'Your crew is with you', desc: 'They follow the same plan on their phone, saved for offline when the signal drops.' },
];

const ALSO_INSIDE = ['Run log', 'Weekly mileage', 'Multiple races', 'Print-ready crew sheet', 'Works offline', 'Route Library'];

export function Landing() {
  const navigate = useNavigate();
  const accountDeleted = !!(useLocation().state as { accountDeleted?: boolean } | null)?.accountDeleted;
  const [heroEmail, setHeroEmail] = useState('');
  // The top bar stays pinned and shrinks once you scroll past the top.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="rg-landing">
      <nav className={`rg-landing-nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="rg-landing-nav-brand">
          <LogoMark size={36} />
          The Runners Guru
        </div>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('/signin');
          }}
        >
          Sign in
        </a>
        <Button variant="primary" onClick={() => navigate('/signup')}>
          Join free
        </Button>
      </nav>

      <section className="rg-landing-hero">
        <div className="rg-landing-hero-inner">
          {accountDeleted && (
            <div className="rg-landing-deleted" role="status">
              Your account and its data have been deleted. Thanks for running with us.
            </div>
          )}
          <div className="rg-landing-eyebrow">Training and race-day planning</div>
          <h1 className="rg-landing-headline">
            Run far.
            <br />
            Run together.
          </h1>
          <p className="rg-landing-subhead">
            Training plans for every distance, and a crew plan built for the long ones — from your first 5K to your next
            300-mile ultra.
          </p>

          <form
            className="rg-landing-capture"
            onSubmit={(e) => {
              e.preventDefault();
              navigate('/signup', { state: { email: heroEmail } });
            }}
          >
            <input
              type="email"
              placeholder="your@email.com"
              aria-label="Email address"
              value={heroEmail}
              onChange={(e) => setHeroEmail(e.target.value)}
            />
            <Button variant="primary" type="submit">
              Join free
            </Button>
          </form>
          <div className="rg-landing-signin-line">
            Already have an account?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate('/signin', { state: { email: heroEmail } });
              }}
            >
              Sign in
            </a>
          </div>

          <div className="rg-landing-hero-stats">
            <div>
              <div className="rg-landing-hero-stat-value">5K to 300+ mi</div>
              <div className="rg-landing-hero-stat-label">Every distance</div>
            </div>
            <div>
              <div className="rg-landing-hero-stat-value">Crew-ready</div>
              <div className="rg-landing-hero-stat-label">One plan, shared</div>
            </div>
            <div>
              <div className="rg-landing-hero-stat-value">Free to join</div>
              <div className="rg-landing-hero-stat-label">No card required</div>
            </div>
          </div>
        </div>

        <div className="rg-landing-scene" aria-hidden="true">
          <span className="rg-landing-sun" />
          <svg viewBox="0 0 1200 320" preserveAspectRatio="xMidYMax slice" fill="none">
            <polygon
              points="0,320 0,210 70,160 130,205 210,120 290,200 370,150 450,215 540,110 640,200 720,160 800,215 890,130 980,205 1060,160 1140,200 1200,170 1200,320"
              fill="currentColor"
              opacity="0.1"
            />
            <polygon
              points="0,320 0,250 90,190 170,240 270,170 360,245 470,150 560,235 660,180 760,250 850,200 950,245 1050,190 1140,235 1200,215 1200,320"
              fill="currentColor"
              opacity="0.17"
            />
            <path
              d="M40 320 C120 300 200 270 270 236 S420 186 470 154"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="2 9"
              opacity="0.6"
            />
            <circle cx="470" cy="152" r="6" fill="currentColor" opacity="0.7" />
          </svg>
        </div>
      </section>

      <section className="rg-landing-section">
        <div className="rg-landing-kicker">Who it's for</div>
        <h2>Whatever your next start line is.</h2>
        <div className="rg-landing-grid">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rg-landing-card">
              <div className="rg-landing-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor">
                  {a.icon}
                </svg>
              </div>
              <div className="rg-landing-card-title">{a.title}</div>
              <p className="rg-landing-card-desc">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rg-landing-section rg-landing-crew">
        <div className="rg-landing-kicker">The Crew Plan</div>
        <h2>Upload the course. Get your whole race day.</h2>
        <p className="rg-landing-lead">
          Drop in your race's GPX file and The Runners Guru finds the aid stations the race organizer marked, then builds the
          plan your crew actually needs: when you will be there, what the weather will be, and what to bring.
        </p>

        <div className="rg-landing-crew-top">
          <ol className="rg-landing-crew-steps">
            {CREW_STEPS.map((st, i) => (
              <li key={st.title}>
                <span className="rg-landing-crew-step-num">{i + 1}</span>
                <div>
                  <div className="rg-landing-crew-step-title">{st.title}</div>
                  <p>{st.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="rg-landing-mock" aria-hidden="true">
            <div className="rg-landing-mock-tag">Example station</div>
            <div className="rg-landing-mock-head">
              <span>Aid station 4</span>
              <span>Mile 52.3</span>
            </div>
            <div className="rg-landing-mock-row">
              <span>You arrive</span>
              <strong>6:40 PM</strong>
            </div>
            <div className="rg-landing-mock-row">
              <span>Cutoff</span>
              <strong>9:00 PM</strong>
            </div>
            <div className="rg-landing-mock-row">
              <span>Ahead of cutoff</span>
              <strong>2 h 20 min</strong>
            </div>
            <div className="rg-landing-mock-row">
              <span>Rest / sleep here</span>
              <strong>1 hr 30 min</strong>
            </div>
            <div className="rg-landing-mock-weather">71°F · 10% chance of rain · wind 6 mph</div>
            <div className="rg-landing-mock-notes">
              <div>
                <b>Drop bag</b> Headlamp + spare batteries, dry socks, warm layer, charger
              </div>
              <div>
                <b>Nutrition</b> Broth and rice, 2 gels for the climb
              </div>
            </div>
            <div className="rg-landing-mock-chips">
              <span>Drop bag</span>
              <span>Pacer pickup</span>
              <span>Planned sleep stop</span>
            </div>
            <div className="rg-landing-mock-link">Driving directions to this station →</div>
            <div className="rg-landing-mock-foot">Race-wide: mandatory gear list, one tap away for you and your crew</div>
          </div>
        </div>

        <div className="rg-landing-grid">
          {CREW_FEATURES.map((f) => (
            <div key={f.title} className="rg-landing-card">
              <div className="rg-landing-card-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor">
                  {f.icon}
                </svg>
              </div>
              <div className="rg-landing-card-title">{f.title}</div>
              <p className="rg-landing-card-desc">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="rg-landing-crew-cta">
          <Button variant="primary" onClick={() => navigate('/signup')}>
            Plan your race day
          </Button>
          <span>Free to join. Works for any race with a GPX file.</span>
        </div>
      </section>

      <section className="rg-landing-section rg-landing-story">
        <div className="rg-landing-kicker">From the first mile to the finish</div>
        <h2>One plan, all the way through.</h2>
        <div className="rg-landing-steps">
          {STEPS.map((s, i) => (
            <div key={s.label} className="rg-landing-step">
              <div className="rg-landing-step-num">{i + 1}</div>
              <div className="rg-landing-step-label">{s.label}</div>
              <div className="rg-landing-card-title">{s.title}</div>
              <p className="rg-landing-card-desc">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="rg-landing-also">
          <span className="rg-landing-also-label">Also inside</span>
          {ALSO_INSIDE.map((item) => (
            <span key={item} className="rg-landing-pill">
              {item}
            </span>
          ))}
        </div>
        <p className="rg-landing-soon">Coming soon: gear, nutrition and strength recommendations.</p>
      </section>

      <section className="rg-landing-cta">
        <h2>Plan the run. Trust the crew.</h2>
        <Button variant="primary" onClick={() => navigate('/signup')}>
          Join free
        </Button>
      </section>

      <footer className="rg-landing-footer">
        <span>The Runners Guru</span>
        <div className="rg-landing-footer-links">
          <Link to="/whats-new">What's new</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy#contact">Contact</Link>
        </div>
        <span>© 2026 The Runners Guru</span>
      </footer>
    </div>
  );
}
