import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Blueprint } from '../components/ui/Blueprint';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { signIn } from '../lib/api';

export function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // AppContext's onAuthStateChange listener hydrates state (profile,
      // plan, logged runs) automatically once the session comes through.
      navigate('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
      setSubmitting(false);
    }
  }

  return (
    <div className="centered-card-page">
      <Blueprint style={{ width: 'min(420px, 100%)', border: '1px solid var(--color-accent-300)', padding: 'var(--space-8) var(--space-6)', background: 'var(--color-bg)' }}>
        <h2 style={{ marginBottom: 'var(--space-1)' }}>Welcome back</h2>
        <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
          Sign in to pick up your training where you left off.
        </p>

        {error && (
          <div style={{ border: '1px solid var(--color-accent-2-600)', background: 'var(--color-accent-2-100)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <Field label="Email" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" style={{ marginBottom: 'var(--space-8)' }}>
          <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        <Button variant="primary" block disabled={!email || !password || submitting} onClick={handleSubmit}>
          {submitting ? 'Signing in…' : 'Sign in →'}
        </Button>

        <div style={{ fontSize: 13, textAlign: 'center', marginTop: 'var(--space-4)' }}>
          New here?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signup'); }}>
            Join free
          </a>
        </div>
      </Blueprint>
    </div>
  );
}
