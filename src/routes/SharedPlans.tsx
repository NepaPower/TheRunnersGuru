import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useApp } from '../state/AppContext';

export function SharedPlans() {
  const { state } = useApp();
  const navigate = useNavigate();

  return (
    <>
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
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ minWidth: 0, wordBreak: 'break-word' }}>
                <div style={{ fontWeight: 600 }}>
                  {s.plan.raceName}
                  {s.ownerName && <span className="text-muted" style={{ fontWeight: 400 }}> — crewing for {s.ownerName}</span>}
                </div>
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

      {!state.trainingPlan && (
        <div
          style={{
            border: '1px solid var(--color-divider)',
            background: 'var(--color-accent-100)',
            padding: 'var(--space-4)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Training for a race yourself?</div>
            <div className="text-muted" style={{ fontSize: 13 }}>
              You can crew for others and have your own training plan at the same time.
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate('/onboarding')}>
            Start my training plan
          </Button>
        </div>
      )}
    </>
  );
}
