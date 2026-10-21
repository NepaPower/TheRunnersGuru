import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { AuthShell } from '../components/AuthShell';
import { signUp, saveProfileAddress, hydrateUserData, resendConfirmation, getCurrentUserId } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { describeError } from '../lib/useOnlineStatus';
import { useApp } from '../state/AppContext';
import type { Address } from '../types';
import './auth.css';

export function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState<Address>({ street: '', unit: '', city: '', state: '', zip: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the account is created but Supabase wants the email confirmed
  // first (no session yet): the form is replaced by a "check your email" panel.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resend, setResend] = useState<{ state: 'idle' | 'sending' | 'sent'; error?: string }>({ state: 'idle' });
  // The confirmation link opens in a NEW tab, which signs the person in there.
  // Supabase tells this (original) tab too, so it can say so instead of
  // sitting on "Confirm your email" forever.
  const [confirmedElsewhere, setConfirmedElsewhere] = useState(false);

  useEffect(() => {
    if (!awaitingConfirmation) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) setConfirmedElsewhere(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [awaitingConfirmation]);

  const zipMissing = address.zip.trim() === '';

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const { user, session } = await signUp(email, password, name, address);
      if (!user) throw new Error('Sign up did not return a user.');

      if (!session) {
        setAwaitingConfirmation(true);
        setSubmitting(false);
        return;
      }

      await saveProfileAddress(user.id, name, address);

      // A brand-new account might already have a pending crew invite
      // waiting for this exact email (sent before the person ever signed
      // up) — hydrateUserData claims it and tells us whether they have
      // any shared plans, so a crew-only signup lands on Shared Plans
      // instead of being forced through training-plan onboarding they
      // never wanted.
      const hydrated = await hydrateUserData(user.id);
      dispatch({ type: 'AUTH_HYDRATE', userId: user.id, ...hydrated });
      navigate(hydrated.sharedPlans.length > 0 ? '/shared-plans' : '/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong signing up.');
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResend({ state: 'sending' });
    try {
      await resendConfirmation(email);
      setResend({ state: 'sent' });
    } catch (e) {
      setResend({ state: 'idle', error: describeError(e, 'Could not resend the email. Please try again in a minute.') });
    }
  }

  /** Carry on in THIS tab once the email was confirmed in another one. */
  async function continueHere() {
    const userId = await getCurrentUserId();
    if (!userId) return;
    const hydrated = await hydrateUserData(userId);
    dispatch({ type: 'AUTH_HYDRATE', userId, ...hydrated });
    navigate(hydrated.trainingPlan ? '/home' : hydrated.sharedPlans.length > 0 ? '/shared-plans' : '/onboarding');
  }

  if (awaitingConfirmation && confirmedElsewhere) {
    return (
      <AuthShell
        eyebrow="You're in"
        headline="Email confirmed."
        blurb="Pick up in the tab that just opened, or carry on right here."
      >
        <div className="rg-auth-card">
          <div className="rg-auth-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              <path d="M5 13l4 4L19 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>You're confirmed</h2>
          <p className="rg-auth-subtitle">
            Your email is confirmed and you're signed in. Carry on in the tab that opened from the email link, or continue
            here and close that one.
          </p>
          <Button variant="primary" block onClick={continueHere}>
            Continue here →
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell
        eyebrow="Almost there"
        headline="Check your email."
        blurb="One tap on the link we sent, and your plan is ready to build."
      >
        <div className="rg-auth-card">
          <div className="rg-auth-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="2" />
              <path d="M3 7l9 6 9-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>Confirm your email</h2>
          <p className="rg-auth-subtitle">
            We sent a confirmation link to <strong>{email}</strong>. Open it to finish setting up your account.
          </p>
          <p className="rg-auth-hint" style={{ textAlign: 'left', marginTop: 0 }}>
            Can't find it? Check your spam or promotions folder. The email comes from The Runners Guru.
          </p>
          {/* Worded the same for everyone on purpose: if this address already has an account, Supabase sends
              nothing and this screen looks identical, and saying so outright would let anyone check whether
              an email is registered. So point the way out without confirming either case. */}
          <p className="rg-auth-hint" style={{ textAlign: 'left', marginTop: 0 }}>
            Already signed up with this address? We won't send a second confirmation.{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate('/signin', { state: { email } });
              }}
            >
              Sign in
            </a>{' '}
            or{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate('/forgot-password', { state: { email } });
              }}
            >
              reset your password
            </a>{' '}
            instead.
          </p>

          {resend.error && <div className="rg-auth-error">{resend.error}</div>}
          <Button variant="secondary" block disabled={resend.state !== 'idle'} onClick={handleResend}>
            {resend.state === 'sending' ? 'Sending…' : resend.state === 'sent' ? 'Sent again. Check your inbox.' : 'Resend the email'}
          </Button>

          <div className="rg-auth-footer-line">
            Wrong address?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setAwaitingConfirmation(false);
                setResend({ state: 'idle' });
              }}
            >
              Go back
            </a>
            {' · '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate('/signin', { state: { email } });
              }}
            >
              Sign in
            </a>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Join The Runners Guru"
      headline="Run far. Run together."
      blurb="Training plans for every distance, and a crew plan built for the long ones."
    >
      <div className="rg-auth-card">
        <div className="rg-auth-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <circle cx="10" cy="8" r="4" strokeWidth="2" />
            <path d="M2 21c1.3-3.7 4.5-6 8-6s6.7 2.3 8 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 8v6M16 11h6" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h2>Create your account</h2>
        <p className="rg-auth-subtitle">Join free — your custom training plan starts right after.</p>

        {error && <div className="rg-auth-error">{error}</div>}

        <Field label="Name" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Street address" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="text" placeholder="123 Main St" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
        </Field>
        <Field label="Apt / Suite" optional style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="text" placeholder="Apt 4B" value={address.unit} onChange={(e) => setAddress({ ...address, unit: e.target.value })} />
        </Field>

        <div className="rg-grid-name" style={{ marginBottom: 'var(--space-4)' }}>
          <Field label="City">
            <Input type="text" placeholder="Austin" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
          </Field>
          <Field label="State">
            <Input type="text" placeholder="TX" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
          </Field>
          <Field label="Zip" required>
            <Input type="text" placeholder="78701" value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} />
          </Field>
        </div>

        <Field label="Phone number" optional style={{ marginBottom: 'var(--space-6)' }}>
          <Input type="tel" placeholder="(555) 555-0100" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
        </Field>

        <Button variant="primary" block disabled={zipMissing || !email || !password || submitting} onClick={handleSubmit}>
          {submitting ? 'Creating account…' : 'Join free →'}
        </Button>
        {zipMissing && <div className="rg-auth-hint">Zip code is required — we use it to find races near you.</div>}

        <div className="rg-auth-hint">
          By joining you agree to our <Link to="/terms">Terms</Link>. We keep your details private: see our{' '}
          <Link to="/privacy">Privacy page</Link>.
        </div>

        <div className="rg-auth-footer-line">
          Already have an account?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signin', { state: { email } }); }}>
            Sign in
          </a>
        </div>
      </div>
    </AuthShell>
  );
}
