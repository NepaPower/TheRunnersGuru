import { useNavigate } from 'react-router-dom';
import { Blueprint } from '../components/ui/Blueprint';
import { Button } from '../components/ui/Button';
import { Tag } from '../components/ui/Form';
import { useApp } from '../state/AppContext';

export function Partners() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const pending = state.matches.filter((m) => m.status === 'pending');
  const accepted = state.matches.filter((m) => m.status === 'accepted');

  return (
    <>
      <h2 style={{ marginBottom: 'var(--space-1)' }}>Runners near you</h2>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        Auto-suggested from your pace, goal and run history.
      </p>

      {pending.length > 0 ? (
        <div className="grid-auto-240" style={{ marginBottom: 'var(--space-8)' }}>
          {pending.map((m) => (
            <Blueprint key={m.id} className="blueprint-card stack-2" style={{ border: '1px solid var(--color-divider)' }}>
              <div className="row-3">
                <div className="avatar-initials avatar-initials--md">{m.initials}</div>
                <div>
                  <div className="card-title">{m.name}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {m.distance} away
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Tag kind="accent">{m.pace}</Tag>
                {m.tags.map((t) => (
                  <Tag key={t} kind="neutral">
                    {t}
                  </Tag>
                ))}
              </div>
              <div className="row-2" style={{ marginTop: 'var(--space-2)' }}>
                <Button variant="secondary" style={{ flex: 1 }} onClick={() => dispatch({ type: 'MATCH_PASS', id: m.id })}>
                  Pass
                </Button>
                <Button variant="primary" style={{ flex: 1 }} onClick={() => dispatch({ type: 'MATCH_ACCEPT', id: m.id })}>
                  Match
                </Button>
              </div>
            </Blueprint>
          ))}
        </div>
      ) : (
        <p className="text-muted" style={{ marginBottom: 'var(--space-8)' }}>
          You've reviewed everyone suggested for now — check back after your next run.
        </p>
      )}

      <h3 style={{ marginBottom: 'var(--space-3)' }}>Your matches</h3>
      <div className="stack-2">
        {accepted.map((m) => (
          <div
            key={m.id}
            className="row-3"
            style={{ padding: 'var(--space-3)', border: '1px solid var(--color-divider)' }}
          >
            <div className="avatar-initials avatar-initials--sm">{m.initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{m.name}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {m.pace} · {m.distance} away
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                dispatch({ type: 'OPEN_CHAT_WITH', id: m.id });
                navigate('/chat');
              }}
            >
              Message
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}
