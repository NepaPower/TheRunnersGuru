import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Blueprint } from '../components/ui/Blueprint';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { useApp } from '../state/AppContext';
import type { Address } from '../types';

export function SignUp() {
  const { dispatch } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [address, setAddress] = useState<Address>({ street: '', unit: '', city: '', state: '', zip: '', phone: '' });

  const zipMissing = address.zip.trim() === '';

  function handleSubmit() {
    dispatch({ type: 'SIGNUP_SUBMIT', name, address });
    navigate('/onboarding');
  }

  return (
    <div className="centered-card-page">
      <Blueprint style={{ width: 'min(420px, 100%)', border: '1px solid var(--color-accent-300)', padding: 'var(--space-8) var(--space-6)', background: 'var(--color-bg)' }}>
        <h2 style={{ marginBottom: 'var(--space-1)' }}>Create your account</h2>
        <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
          Join free — your custom training plan starts right after.
        </p>

        <Field label="Name" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="email" placeholder="your@email.com" />
        </Field>
        <Field label="Password" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="password" placeholder="••••••••" />
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

        <Field label="Phone number" optional style={{ marginBottom: 'var(--space-8)' }}>
          <Input type="tel" placeholder="(555) 555-0100" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
        </Field>

        <Button variant="primary" block disabled={zipMissing} onClick={handleSubmit}>
          Join free →
        </Button>
        {zipMissing && (
          <div className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-2)', textAlign: 'center' }}>
            Zip code is required — we use it to find races near you.
          </div>
        )}

        <div style={{ fontSize: 13, textAlign: 'center', marginTop: 'var(--space-4)' }}>
          Already have an account?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signin'); }}>
            Sign in
          </a>
        </div>
      </Blueprint>
    </div>
  );
}
