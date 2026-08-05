import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useApp } from '../../state/AppContext';
import { distanceGoalLabel, paceLabel } from '../../state/selectors';
import { signOut } from '../../lib/api';
import type { ProfileTab } from '../../types';
import { StatsTab } from './StatsTab';
import { LeaderboardTab } from './LeaderboardTab';
import { ChallengesTab } from './ChallengesTab';
import { SettingsTab } from './SettingsTab';

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'stats', label: 'Stats' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'settings', label: 'Settings' },
];

export function Profile() {
  const { state, dispatch } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Support deep-linking into a specific tab, e.g. /profile?tab=settings
  // (used by the Dashboard's "Runner profile" button).
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.some((t) => t.id === tab)) {
      dispatch({ type: 'PROFILE_SET_TAB', tab: tab as ProfileTab });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleLogout() {
    await signOut();
    navigate('/');
  }

  return (
    <>
      <div className="row-3" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="avatar-initials avatar-initials--md" style={{ width: 56, height: 56, fontSize: 14 }}>
          YOU
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ marginBottom: 2 }}>Your profile</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {distanceGoalLabel(state)} · {paceLabel(state)}
          </div>
        </div>
        {/* Only reachable path to logging out on mobile now that the
            bottom tab bar replaced the hamburger's "Log out" button —
            desktop still also has the one in the top nav. */}
        <Button variant="ghost" onClick={handleLogout}>
          Log out
        </Button>
      </div>

      <div className="seg" style={{ marginBottom: 'var(--space-6)', display: 'inline-flex' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className="seg-opt"
            style={{
              background: state.profileTab === t.id ? 'var(--color-accent)' : 'transparent',
              color: state.profileTab === t.id ? 'var(--color-bg)' : 'var(--color-text)',
              border: 'none',
              cursor: 'pointer',
              font: 'inherit',
            }}
            onClick={() => dispatch({ type: 'PROFILE_SET_TAB', tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {state.profileTab === 'stats' && <StatsTab />}
      {state.profileTab === 'leaderboard' && <LeaderboardTab />}
      {state.profileTab === 'challenges' && <ChallengesTab />}
      {state.profileTab === 'settings' && <SettingsTab />}
    </>
  );
}
