import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { AuthShell } from '../components/AuthShell';
import { requestPasswordReset, getCurrentUserId, hydrateUserData } from '../lib/api';
import { useApp } from '../state/AppContext';
import { supabase } from '../lib/supabaseClient';
import { useOnlineStatus, describeError } from '../lib/useOnlineStatus';
import './auth.css';

/** "Forgot password?" from the sign-in page: asks for the account's email and
 * sends a reset link. The reply is the same whether or not an account exists
 * (Supabase does the same), so this page can't be used to find out who has one. */
export function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnlineStatus();
  const { dispatch } = useApp();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The emailed link opens in a NEW tab. Supabase tells this (original) tab
  // when that happens, so it can say where to carry on instead of staying put.
  const [elsewhere, setElsewhere] = useState<'idle' | 'opened' | 'updated'>('idle');

  useEffect(() => {
    if (!sent) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'USER_UPDATED') setElsewhere('updated');
      else if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') setElsewhere((cur) => (cur === 'updated' ? cur : 'opened'));
    });
    return () => sub.subscription.unsubscribe();
  }, [sent]);

  /** The password was set in the other tab, which also signed the person in:
   * load their data here and carry on, as signing in would. */
  async function continueHere() {
    const userId = await getCurrentUserId();
    if (!userId) {
      navigate('/signin', { state: { email } });
      return;
    }
    const hydrated = await hydrateUserData(userId);
    dispatch({ type: 'AUTH_HYDRATE', userId, ...hydrated });
    navigate(hydrated.trainingPlan ? '/home' : hydrated.sharedPlans.length > 0 ? '/shared-plans' : '/onboarding');
  }

  async function handleSubmit() {
    setError(null);
    if (!online) {
      setError("You're offline. Reconnect and try again.");
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(describeError(e, 'Could not send the email. Please try again in a minute.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account help"
      headline="Back on the trail."
      blurb="We'll email you a link to choose a new password."
    >
      <div className="rg-auth-card">
        <div className="rg-auth-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <rect x="4" y="11" width="16" height="9" rx="2" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {sent && elsewhere !== 'idle' ? (
          <>
            <h2>{elsewhere === 'updated' ? 'Password updated' : 'Link opened'}</h2>
            <p className="rg-auth-subtitle">
              {elsewhere === 'updated'
                ? "Your new password is set and you're signed in. You can close this tab, or carry on here."
                : 'Your reset link opened in another tab. Choose your new password there, then you can close this tab.'}
            </p>
            {elsewhere === 'updated' && (
              <Button variant="primary" block onClick={continueHere}>
                Continue →
              </Button>
            )}
          </>
        ) : sent ? (
          <>
            <h2>Check your email</h2>
            <p className="rg-auth-subtitle">
              If there's an account for <strong>{email.trim()}</strong>, we've sent a link to choose a new password. It
              expires in about an hour.
            </p>
            <p className="rg-auth-hint" style={{ textAlign: 'left', marginTop: 0 }}>
              Can't find it? Check your spam or promotions folder. The email comes from The Runners Guru.
            </p>
            <Button variant="secondary" block onClick={() => navigate('/signin', { state: { email } })}>
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <h2>Forgot your password?</h2>
            <p className="rg-auth-subtitle">Enter the email you signed up with and we'll send you a reset link.</p>

            {error && <div className="rg-auth-error">{error}</div>}

            <Field label="Email" style={{ marginBottom: 'var(--space-6)' }}>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && email && !submitting) handleSubmit();
                }}
              />
            </Field>

            <Button variant="primary" block disabled={!email.trim() || submitting} onClick={handleSubmit}>
              {submitting ? 'Sending…' : 'Send reset link →'}
            </Button>

            <div className="rg-auth-footer-line">
              Remembered it? <Link to="/signin" state={{ email }}>Sign in</Link>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
