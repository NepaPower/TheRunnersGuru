import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { BrandHeader } from '../components/Logo';
import { signUp, saveProfileAddress } from '../lib/api';
import type { Address } from '../types';
import './auth.css';

export function SignUp() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState<Address>({ street: '', unit: '', city: '', state: '', zip: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zipMissing = address.zip.trim() === '';

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const { user, session } = await signUp(email, password, name);
      if (!user) throw new Error('Sign up did not return a user.');

      if (!session) {
        setError('Check your email to confirm your account, then sign in.');
        setSubmitting(false);
        return;
      }

      await saveProfileAddress(user.id, name, address);
      navigate('/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong signing up.');
      setSubmitting(false);
    }
  }

  return (
    <div className="rg-auth-page">
      <BrandHeader />
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

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
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

        <div className="rg-auth-footer-line">
          Already have an account?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signin'); }}>
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
