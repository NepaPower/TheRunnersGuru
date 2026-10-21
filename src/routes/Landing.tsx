import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const STEPS = [
  { label: 'Before', title: 'Train with a plan', desc: 'Built backward from race day, with a target pace for every workout.' },
  { label: 'During', title: 'Race with a plan', desc: 'Your Crew Plan shows when you reach each aid station, and the weather when you get there.' },
  { label: 'All night', title: 'Your crew is with you', desc: 'They follow the same plan on their phone, saved for offline when the signal drops.' },
];

const ALSO_INSIDE = ['Run log', 'Weekly mileage', 'Multiple races', 'Print-ready crew sheet', 'Works offline', 'Route Library'];

export function Landing() {
  const navigate = useNavigate();
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
        <svg className="rg-landing-nav-scene" viewBox="0 0 1200 60" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <polygon
            points="0,60 0,34 70,14 140,36 230,6 320,34 410,12 510,38 610,4 710,32 810,10 910,36 1010,8 1110,34 1200,16 1200,60"
            fill="currentColor"
            opacity="0.14"
          />
          <polygon
            points="0,60 0,46 90,26 180,48 290,22 390,48 510,30 630,52 750,24 870,50 990,28 1100,52 1200,34 1200,60"
            fill="currentColor"
            opacity="0.24"
          />
        </svg>
      </nav>

      <section className="rg-landing-hero">
        <div className="rg-landing-hero-inner">
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
          <span>Privacy</span>
          <span>Terms</span>
          <span>Contact</span>
        </div>
        <span>© 2026 The Runners Guru</span>
      </footer>
    </div>
  );
}
