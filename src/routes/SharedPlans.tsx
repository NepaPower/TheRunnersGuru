import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { BrandHeader } from '../components/Logo';
import { useApp } from '../state/AppContext';
import { signOut } from '../lib/api';
import '../routes/auth.css';

export function SharedPlans() {
  const { state } = useApp();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="rg-auth-page">
      <BrandHeader />
      <div className="rg-auth-card" style={{ width: 'min(560px, 100%)' }}>
        <h2 style={{ marginBottom: 'var(--space-1)' }}>Crew Plans shared with you</h2>
        <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
          You've been granted crew access to the plans below. Open one to see aid stations, pacing, and add your own
          notes.
        </p>

        {state.sharedPlans.length === 0 ? (
          <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
            No plans shared with you yet — ask the runner to invite you from their Crew Plan screen using this
            account's email address.
          </p>
        ) : (
          <div className="stack-3" style={{ marginBottom: 'var(--space-6)' }}>
            {state.sharedPlans.map((s) => (
              <div
                key={s.accessId}
                style={{
                  border: '1px solid var(--color-accent-300)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{s.plan.raceName}</div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    {s.plan.raceDate}
                  </div>
                </div>
                <Button variant="primary" onClick={() => navigate(`/crew-plan/shared/${s.plan.id}`)}>
                  Open
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button variant="ghost" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </div>
  );
}
