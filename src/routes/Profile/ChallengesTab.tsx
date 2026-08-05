import { Blueprint } from '../../components/ui/Blueprint';
import { CHALLENGES } from '../../data/constants';

export function ChallengesTab() {
  return (
    <div className="stack-4">
      {CHALLENGES.map((ch) => (
        <Blueprint key={ch.id} className="blueprint-card" style={{ border: '1px solid var(--color-divider)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <div className="card-title">{ch.title}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {ch.progress}%
            </div>
          </div>
          <p className="card-body" style={{ marginBottom: 'var(--space-3)' }}>
            {ch.desc}
          </p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${ch.progress}%` }} />
          </div>
        </Blueprint>
      ))}
    </div>
  );
}
