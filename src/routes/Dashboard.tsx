import { useNavigate } from 'react-router-dom';
import { Blueprint } from '../components/ui/Blueprint';
import { Button } from '../components/ui/Button';
import { useApp } from '../state/AppContext';
import { homeStats } from '../state/selectors';

const NAV_CARDS = [
  { key: 'trainingPlan', title: 'Your Training Plan', subtitle: 'See this week and beyond', to: '/training-plan', enabled: true },
  { key: 'logRun', title: 'Log a Run', subtitle: 'Add a run you tracked elsewhere', to: '/log-run', enabled: true },
  { key: 'gears', title: 'Recommended Gears', subtitle: 'Coming soon', to: '/gears', enabled: false },
  { key: 'nutrition', title: 'Recommended Nutrition', subtitle: 'Coming soon', to: '/nutrition', enabled: false },
  { key: 'strength', title: 'Strength Workout', subtitle: 'Coming soon', to: '/strength', enabled: false },
];

export function Dashboard() {
  const { state } = useApp();
  const navigate = useNavigate();
  const stats = homeStats(state);
  const hasPlan = !!state.trainingPlan;

  return (
    <>
      <div className="row-4" style={{ alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ marginBottom: 0 }}>Welcome back{state.auth.firstName ? `, ${state.auth.firstName}` : ''}.</h2>
        <Button variant="secondary" onClick={() => navigate('/profile?tab=settings')}>
          Runner profile
        </Button>
      </div>
      <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
        Here's where things stand this week.
      </p>

      <div className="grid-auto-160" style={{ marginBottom: 'var(--space-6)' }}>
        {stats.map((stat) => (
          <Blueprint key={stat.label} className="blueprint-card" style={{ border: '1px solid var(--color-divider)' }}>
            <div className="card-kicker">{stat.label}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 600, marginTop: 'var(--space-1)' }}>
              {stat.value}
            </div>
          </Blueprint>
        ))}
      </div>

      {hasPlan && (
        <div className="grid-auto-200">
          {NAV_CARDS.map((c) => (
            <Blueprint
              key={c.key}
              className="blueprint-card"
              style={{ border: '1px solid var(--color-divider)', cursor: c.enabled ? 'pointer' : 'default', opacity: c.enabled ? 1 : 0.6 }}
              onClick={() => c.enabled && navigate(c.to)}
            >
              <div className="card-title" style={{ fontSize: 18, marginBottom: 4 }}>
                {c.title}
              </div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {c.subtitle}
              </div>
            </Blueprint>
          ))}
        </div>
      )}
    </>
  );
}
