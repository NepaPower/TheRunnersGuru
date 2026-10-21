import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { AuthShell } from '../components/AuthShell';
import { signIn, hydrateUserData, resendConfirmation } from '../lib/api';
import { useApp } from '../state/AppContext';
import { useOnlineStatus, describeError } from '../lib/useOnlineStatus';
import './auth.css';

export function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useApp();
  const online = useOnlineStatus();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Supabase refuses sign-in until the signup email was confirmed.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function handleResend() {
    setResend('sending');
    try {
      await resendConfirmation(email);
      setResend('sent');
    } catch (e) {
      setError(describeError(e, 'Could not resend the email. Please try again in a minute.'));
      setResend('idle');
    }
  }

  async function handleSubmit() {
    setError(null);
    setUnconfirmed(false);
    if (!online) {
      setError("You're offline. Signing in needs an internet connection — reconnect and try again.");
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await signIn(email, password);
      if (!user) throw new Error('Sign in did not return a user.');

      const hydrated = await hydrateUserData(user.id);
      dispatch({ type: 'AUTH_HYDRATE', userId: user.id, ...hydrated });
      navigate(
        hydrated.ownPlans.length >= 2
          ? '/races'
          : hydrated.trainingPlan
            ? '/home'
            : hydrated.sharedPlans.length > 0
              ? '/shared-plans'
              : '/onboarding',
      );
    } catch (e) {
      if (e instanceof Error && /not confirmed/i.test(e.message)) {
        setUnconfirmed(true);
        setError('Please confirm your email first. We sent you a link when you signed up. Check your inbox and spam folder.');
      } else {
        setError(describeError(e, 'Could not sign in. Check your email and password.'));
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      headline="Pick up where you left off."
      blurb="This week's plan, your crew, and every mile to race day."
    >
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
        {unconfirmed && (
          <Button
            variant="secondary"
            block
            disabled={resend !== 'idle' || !email}
            onClick={handleResend}
            style={{ marginBottom: 'var(--space-4)' }}
          >
            {resend === 'sending' ? 'Sending…' : resend === 'sent' ? 'Sent again. Check your inbox.' : 'Resend the confirmation email'}
          </Button>
        )}

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

        <div className="rg-auth-hint">
          <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
        </div>
      </div>
    </AuthShell>
  );
}
