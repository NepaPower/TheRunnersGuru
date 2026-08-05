import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { BrandHeader } from '../components/Logo';
import { signIn, hydrateUserData } from '../lib/api';
import { useApp } from '../state/AppContext';
import './auth.css';

export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useApp();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await signIn(email, password);
      if (!user) throw new Error('Sign in did not return a user.');

      const hydrated = await hydrateUserData(user.id);
      dispatch({ type: 'AUTH_HYDRATE', userId: user.id, ...hydrated });
      navigate(hydrated.trainingPlan ? '/home' : hydrated.sharedPlans.length > 0 ? '/shared-plans' : '/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
      setSubmitting(false);
    }
  }

  return (
    <div className="rg-auth-page">
      <BrandHeader />
      <div className="rg-auth-card">
        <div className="rg-auth-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <circle cx="12" cy="8" r="4" strokeWidth="2" />
            <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2>Welcome back</h2>
        <p className="rg-auth-subtitle">Sign in to pick up your training where you left off.</p>

        {error && <div className="rg-auth-error">{error}</div>}

        <Field label="Email" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" style={{ marginBottom: 'var(--space-6)' }}>
          <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <Button variant="primary" block disabled={!email || !password || submitting} onClick={handleSubmit}>
          {submitting ? 'Signing in…' : 'Sign in →'}
        </Button>

        <div className="rg-auth-footer-line">
          New here?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signup', { state: { email } }); }}>
            Join free
          </a>
        </div>
      </div>
    </div>
  );
}
