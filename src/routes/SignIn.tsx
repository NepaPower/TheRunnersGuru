import { useNavigate } from 'react-router-dom';
import { Blueprint } from '../components/ui/Blueprint';
import { Field, Input } from '../components/ui/Form';
import { Button } from '../components/ui/Button';
import { useApp } from '../state/AppContext';

export function SignIn() {
  const { dispatch } = useApp();
  const navigate = useNavigate();

  function handleSubmit() {
    dispatch({ type: 'SIGNIN_SUBMIT' });
    navigate('/home');
  }

  return (
    <div className="centered-card-page">
      <Blueprint style={{ width: 'min(420px, 100%)', border: '1px solid var(--color-accent-300)', padding: 'var(--space-8) var(--space-6)', background: 'var(--color-bg)' }}>
        <h2 style={{ marginBottom: 'var(--space-1)' }}>Welcome back</h2>
        <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
          Sign in to pick up your training where you left off.
        </p>

        <Field label="Email" style={{ marginBottom: 'var(--space-4)' }}>
          <Input type="email" placeholder="your@email.com" />
        </Field>
        <Field label="Password" style={{ marginBottom: 'var(--space-8)' }}>
          <Input type="password" placeholder="••••••••" />
        </Field>

        <Button variant="primary" block onClick={handleSubmit}>
          Sign in →
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
