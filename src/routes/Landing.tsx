import { useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { LANDING_FEATURES } from '../data/constants';
import './landing.css';

// Feature icons — small, purposeful glyphs (no icon library dependency),
// one per card, cycling through the three accent colors via CSS nth-child.
const FEATURE_ICONS = [
  <path key="a" d="M4 17l5-6 4 4 7-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  <path key="b" d="M12 3v18M6 8l6-5 6 5M6 16l6 5 6-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  <path key="c" d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  <path key="d" d="M13 3L5 13h5l-1 8 8-11h-5l1-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  <path key="e" d="M12 21c4-3 7-6.5 7-11a7 7 0 10-14 0c0 4.5 3 8 7 11z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  <path key="f" d="M5 21l4-11 3 6 3-9 4 14M5 21h14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  <path key="g" d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  <path key="h" d="M17 11a5 5 0 10-10 0c0 3 2 4 2 7h6c0-3 2-4 2-7z M9 21h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
];

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="rg-landing">
      <section className="rg-landing-hero">
        <nav className="rg-landing-nav">
          <div className="rg-landing-nav-brand">
            <LogoMark size={26} />
            The Runners Guru
          </div>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signin'); }}>
            Sign in
          </a>
          <Button variant="primary" onClick={() => navigate('/signup')}>
            Join free →
          </Button>
        </nav>

        {/* Background contour lines — faint topographic texture, like
            elevation lines on a trail map, filling the predawn section. */}
        <svg className="rg-landing-hero-contours" viewBox="0 0 800 500" preserveAspectRatio="none" aria-hidden="true">
          {[60, 120, 175, 235, 300, 360, 420, 470].map((y, i) => (
            <path
              key={y}
              d={`M0,${y} Q100,${y - 22} 200,${y} T400,${y} T600,${y} T800,${y}`}
              fill="none"
              stroke="#f4efe1"
              strokeWidth="1"
              opacity={0.08 + (i % 3) * 0.03}
            />
          ))}
        </svg>

        <div className="rg-landing-hero-inner">
          <div>
            <div className="rg-landing-eyebrow">Before sunrise, every mile counts</div>
            <h1 className="rg-landing-headline">
              Your next <em>mile</em>
              <br />
              starts here
            </h1>
            <p className="rg-landing-subhead">
              Intelligent training plans built around you — whether it's your first 5K or your next 100-miler. Pick
              your distance, upload your route, and let AI handle the rest.
            </p>

            <form className="rg-landing-capture" onSubmit={(e) => { e.preventDefault(); navigate('/signup'); }}>
              <input type="email" placeholder="your@email.com" aria-label="Email address" />
              <Button variant="primary" type="submit">
                Join free
              </Button>
            </form>
            <div className="rg-landing-signin-line">
              Already have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signin'); }}>
                Sign in
              </a>
            </div>

            <div className="rg-landing-hero-stats">
              <div>
                <div className="rg-landing-hero-stat-value">5K–100mi</div>
                <div className="rg-landing-hero-stat-label">Every distance covered</div>
              </div>
              <div>
                <div className="rg-landing-hero-stat-value">100%</div>
                <div className="rg-landing-hero-stat-label">Plans built for your race</div>
              </div>
              <div>
                <div className="rg-landing-hero-stat-value">Free</div>
                <div className="rg-landing-hero-stat-label">No card required</div>
              </div>
            </div>
          </div>

          {/* Signature graphic: a route line drawing itself in, like a GPS
              track from a finished run — start marker, winding path, finish. */}
          <div className="rg-landing-route-wrap">
            <svg viewBox="0 0 420 380" width="100%" height="100%" aria-hidden="true">
              {/* Rocky mountain "skeleton" — layered jagged ridgelines, drawn
                  as bare outlines rather than solid silhouettes, echoing the
                  contour-line motif elsewhere in the hero. */}
              <path
                d="M0,260 L20,230 L35,245 L55,190 L70,210 L90,175 L110,200 L130,160 L150,195 L175,150 L200,185 L225,140 L250,180 L275,155 L300,190 L330,150 L360,185 L390,160 L420,195"
                fill="none"
                stroke="#3a5145"
                strokeWidth="1.5"
                strokeLinejoin="round"
                opacity="0.5"
              />
              <path
                d="M0,300 L25,250 L40,270 L65,210 L85,235 L100,190 L125,225 L145,175 L170,215 L190,165 L215,205 L240,155 L260,195 L285,150 L305,190 L335,145 L360,180 L385,150 L420,185"
                fill="none"
                stroke="#4a6b58"
                strokeWidth="1.75"
                strokeLinejoin="round"
                opacity="0.7"
              />
              <path
                d="M0,330 L15,300 L30,315 L50,270 L60,285 L80,240 L95,260 L115,210 L130,235 L150,190 L165,220 L185,175 L200,210 L220,165 L235,195 L255,155 L270,185 L295,145 L310,175 L335,140 L355,170 L375,150 L400,175 L420,155"
                fill="none"
                stroke="#6f8f76"
                strokeWidth="2"
                strokeLinejoin="round"
                opacity="0.9"
              />

              {/* Switchback trail — a running route climbing the rocky
                  ridge, drawing itself in like a finished route on a GPS
                  watch. */}
              <path
                className="rg-landing-route-path"
                d="M30,340 L78,318 L48,292 L98,270 L68,242 L118,222 L88,192 L140,175 L165,220 L200,210 L220,165 L250,180 L270,185 L295,145 L320,168 L345,205 L370,225"
                fill="none"
                stroke="#d9a441"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="30" cy="340" r="6" fill="#f4efe1" />
              <circle className="rg-landing-route-dot" cx="370" cy="225" r="8" fill="#d9a441" stroke="#16241f" strokeWidth="3" />
            </svg>
          </div>
        </div>
      </section>

      <section className="rg-landing-features">
        <div className="rg-landing-section-kicker">Why runners choose Guru</div>
        <h2>Everything you need between now and race day.</h2>
        <div className="rg-landing-feature-grid">
          {LANDING_FEATURES.map((f, i) => (
            <div key={f.title} className="rg-landing-feature-card">
              <div className="rg-landing-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor">
                  {FEATURE_ICONS[i % FEATURE_ICONS.length]}
                </svg>
              </div>
              <div className="rg-landing-feature-title">{f.title}</div>
              <p className="rg-landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rg-landing-cta">
        <h2>Every runner. Every distance. Every mile — smarter.</h2>
        <Button variant="primary" onClick={() => navigate('/signup')}>
          Start your custom plan
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
