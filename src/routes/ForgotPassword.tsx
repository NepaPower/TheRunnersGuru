import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { AuthShell } from '../components/AuthShell';
import { requestPasswordReset } from '../lib/api';
import { useOnlineStatus, describeError } from '../lib/useOnlineStatus';
import './auth.css';

/** "Forgot password?" from the sign-in page: asks for the account's email and
 * sends a reset link. The reply is the same whether or not an account exists
 * (Supabase does the same), so this page can't be used to find out who has one. */
export function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnlineStatus();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        {sent ? (
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
