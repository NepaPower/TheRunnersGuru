import { useNavigate } from 'react-router-dom';
import { Wordmark } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { Blueprint } from '../components/ui/Blueprint';
import { Input } from '../components/ui/Form';
import { LANDING_FEATURES } from '../data/constants';

export function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ background: 'var(--color-accent-100)', display: 'flex', flexDirection: 'column' }}>
      <nav className="nav container" style={{ color: 'var(--color-text)' }}>
        <div className="nav-brand">
          <Wordmark fontSize={30} />
        </div>
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signin'); }} style={{ color: 'var(--color-text)', opacity: 0.8 }}>
          Sign in
        </a>
        <Button variant="primary" onClick={() => navigate('/signup')}>
          Join free →
        </Button>
      </nav>

      <div
        className="container"
        style={{
          padding: 'var(--space-6) var(--space-4)',
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: 'var(--space-6)',
          alignItems: 'center',
        }}
      >
        <div>
          <div className="row-2" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ width: 24, height: 1, background: 'var(--color-accent-700)' }} />
            <h6 style={{ color: 'var(--color-accent-700)', margin: 0 }}>The runner's intelligence platform</h6>
          </div>
          <h1 style={{ fontSize: 64, textTransform: 'uppercase', lineHeight: 1.02, marginBottom: 'var(--space-4)' }}>
            Your next <span style={{ color: 'var(--color-accent-700)' }}>mile</span>
            <br />
            starts here
          </h1>
          <p style={{ fontSize: 16, opacity: 0.75, maxWidth: 440, marginBottom: 'var(--space-6)' }}>
            Intelligent training plans built around you — whether it's your first 5K or your next 100-miler. Pick your
            distance, upload your route, and let AI handle the rest.
          </p>

          <div className="row-2" style={{ marginBottom: 'var(--space-3)' }}>
            <Input
              type="email"
              placeholder="your@email.com"
              style={{ background: 'transparent', borderColor: 'var(--color-accent-300)', color: 'var(--color-text)' }}
            />
            <Button variant="primary" onClick={() => navigate('/signup')} style={{ whiteSpace: 'nowrap' }}>
              Join free
            </Button>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Already have an account?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signin'); }} style={{ color: 'var(--color-accent-700)' }}>
              Sign in
            </a>
          </div>
        </div>

        <Blueprint style={{ border: '1px solid var(--color-accent-300)' }}>
          <div className="hero-image-slot">Trail-running hero photo goes here</div>
        </Blueprint>
      </div>

      <div style={{ borderTop: '1px solid var(--color-accent-300)', padding: 'var(--space-4)' }}>
        <div className="container" style={{ padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
          {LANDING_FEATURES.map((f) => (
            <Blueprint key={f.title} style={{ border: '1px solid var(--color-accent-300)', padding: 'var(--space-3)' }}>
              <div className="card-title" style={{ marginBottom: 6, fontSize: 15 }}>
                {f.title}
              </div>
              <p className="card-body" style={{ fontSize: 12 }}>
                {f.desc}
              </p>
            </Blueprint>
          ))}
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--color-accent-300)',
          background: 'var(--color-accent-900)',
          color: 'var(--color-bg)',
          padding: 'var(--space-8) var(--space-4)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ marginBottom: 'var(--space-4)' }}>Every runner. Every distance. Every mile — smarter.</h2>
        <Button variant="primary" onClick={() => navigate('/signup')}>
          Start your custom plan
        </Button>
      </div>

      <div style={{ borderTop: '1px solid var(--color-accent-300)' }}>
        <div
          className="container"
          style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, opacity: 0.7 }}
        >
          <span>Runners Guru</span>
          <div className="row-4">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Contact</span>
          </div>
          <span>© 2026 Runners Guru</span>
        </div>
      </div>
    </div>
  );
}
