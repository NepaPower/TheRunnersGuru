import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { WeeklyMileageChart } from '../components/WeeklyMileageChart';
import { useApp } from '../state/AppContext';
import { homeStats, weeklyMileageSeries } from '../state/selectors';
import './dashboard.css';

const STAT_ICONS: Record<string, JSX.Element> = {
  'This week': <path d="M4 17l5-6 4 4 7-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  'Runs logged': (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth="2" fill="none" />
      <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  'Current streak': (
    <path
      d="M12 2c1 3-3 4-3 8a3 3 0 006 0c0-2-1-3-1-5 2 1 3 3 3 6a5 5 0 01-10 0c0-4 3-6 5-9z"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  'Avg. pace': (
    <>
      <circle cx="12" cy="13" r="8" strokeWidth="2" fill="none" />
      <path d="M12 9v4l3 2M9 2h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
};

const NAV_CARDS = [
  {
    key: 'trainingPlan',
    title: 'Your Training Plan',
    subtitle: 'See this week and beyond',
    to: '/training-plan',
    enabled: true,
    icon: <path d="M9 20l-5-2V4l5 2 6-2 5 2v14l-5-2-6 2z M9 6v14M15 4v14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  },
  {
    key: 'logRun',
    title: 'Log a Run',
    subtitle: 'Add a run you tracked elsewhere',
    to: '/log-run',
    enabled: true,
    icon: (
      <>
        <circle cx="12" cy="12" r="9" strokeWidth="2" fill="none" />
        <path d="M12 8v8M8 12h8" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  {
    key: 'gears',
    title: 'Recommended Gears',
    subtitle: 'Coming soon',
    to: '/gears',
    enabled: false,
    icon: <path d="M17 11a5 5 0 10-10 0c0 3 2 4 2 7h6c0-3 2-4 2-7z M9 21h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  },
  {
    key: 'nutrition',
    title: 'Recommended Nutrition',
    subtitle: 'Coming soon',
    to: '/nutrition',
    enabled: false,
    icon: <path d="M13 3L5 13h5l-1 8 8-11h-5l1-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  },
  {
    key: 'strength',
    title: 'Strength Workout',
    subtitle: 'Coming soon',
    to: '/strength',
    enabled: false,
    icon: (
      <path
        d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
];

export function Dashboard() {
  const { state } = useApp();
  const navigate = useNavigate();
  const stats = homeStats(state);
  const week = weeklyMileageSeries(state);
  const hasPlan = !!state.trainingPlan;
  const hasAnyRuns = state.loggedRuns.length > 0;

  return (
    <>
      <div className="rg-dash-header">
        <div>
          <h2 style={{ marginBottom: 0 }}>Welcome back{state.auth.firstName ? `, ${state.auth.firstName}` : ''}.</h2>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Here's where things stand this week.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/profile?tab=settings')}>
          Runner profile
        </Button>
      </div>

      <div className="rg-dash-stat-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="rg-dash-stat-card">
            <div className="rg-dash-stat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor">
                {STAT_ICONS[stat.label]}
              </svg>
            </div>
            <div className="rg-dash-stat-value">{stat.value}</div>
            <div className="rg-dash-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="rg-dash-chart-card">
        <div className="rg-dash-chart-header">
          <div className="rg-dash-chart-title">Miles this week</div>
          {hasAnyRuns && <div className="text-muted" style={{ fontSize: 12 }}>Last 7 days</div>}
        </div>
        {hasAnyRuns ? (
          <WeeklyMileageChart data={week} />
        ) : (
          <div className="rg-dash-chart-empty">
            <p className="text-muted" style={{ marginBottom: 'var(--space-3)' }}>
              No runs logged yet — your weekly mileage will show up here.
            </p>
            <Button variant="secondary" onClick={() => navigate('/log-run')}>
              Log your first run
            </Button>
          </div>
        )}
      </div>

      {hasPlan && (
        <div className="rg-dash-nav-grid">
          {NAV_CARDS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`rg-dash-nav-card${c.enabled ? '' : ' is-disabled'}`}
              disabled={!c.enabled}
              onClick={() => c.enabled && navigate(c.to)}
            >
              {!c.enabled && <span className="rg-dash-badge">Soon</span>}
              <div className="rg-dash-nav-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor">
                  {c.icon}
                </svg>
              </div>
              <div className="rg-dash-nav-title">{c.title}</div>
              <div className="rg-dash-nav-subtitle">{c.subtitle}</div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
