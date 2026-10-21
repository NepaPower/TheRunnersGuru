import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { AuthShell } from '../components/AuthShell';
import { supabase } from '../lib/supabaseClient';
import { updatePassword } from '../lib/api';
import { describeError } from '../lib/useOnlineStatus';
import './auth.css';

const MIN_LENGTH = 8;

/** Where the emailed reset link lands. Supabase signs the person in from the
 * link (a short-lived "recovery" session), so this page only has to ask for a
 * new password. With no session (an expired or reused link) it says so and
 * offers a fresh link instead. */
export function ResetPassword() {
  const navigate = useNavigate();
  // 'checking' until Supabase has had a chance to read the link in the URL.
  const [link, setLink] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setLink(data.session ? 'ok' : 'invalid');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setLink('ok');
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !submitting;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e) {
      setError(describeError(e, 'Could not update your password. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account help"
      headline="Fresh start."
      blurb="Choose a new password and you're back in."
    >
      <div className="rg-auth-card">
        <div className="rg-auth-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <rect x="4" y="11" width="16" height="9" rx="2" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {link === 'checking' && <p className="rg-auth-subtitle">Checking your link…</p>}

        {link === 'invalid' && (
          <>
            <h2>This link has expired</h2>
            <p className="rg-auth-subtitle">
              Reset links work once and expire after about an hour. Request a new one and we'll send it right away.
            </p>
            <Button variant="primary" block onClick={() => navigate('/forgot-password')}>
              Request a new link
            </Button>
            <div className="rg-auth-footer-line">
              <Link to="/signin">Back to sign in</Link>
            </div>
          </>
        )}

        {link === 'ok' && done && (
          <>
            <h2>Password updated</h2>
            <p className="rg-auth-subtitle">You're signed in with your new password.</p>
            <Button variant="primary" block onClick={() => navigate('/home')}>
              Continue →
            </Button>
          </>
        )}

        {link === 'ok' && !done && (
          <>
            <h2>Choose a new password</h2>
            <p className="rg-auth-subtitle">At least {MIN_LENGTH} characters.</p>

            {error && <div className="rg-auth-error">{error}</div>}

            <Field label="New password" style={{ marginBottom: 'var(--space-4)' }}>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {tooShort && (
              <div className="rg-auth-hint" style={{ textAlign: 'left', marginTop: 'calc(-1 * var(--space-2))', marginBottom: 'var(--space-3)' }}>
                Use at least {MIN_LENGTH} characters.
              </div>
            )}
            <Field label="Confirm new password" style={{ marginBottom: 'var(--space-6)' }}>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) handleSubmit();
                }}
              />
            </Field>
            {mismatch && (
              <div className="rg-auth-hint" style={{ textAlign: 'left', marginTop: 'calc(-1 * var(--space-4))', marginBottom: 'var(--space-3)' }}>
                The two passwords don't match yet.
              </div>
            )}

            <Button variant="primary" block disabled={!canSubmit} onClick={handleSubmit}>
              {submitting ? 'Saving…' : 'Set new password'}
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
