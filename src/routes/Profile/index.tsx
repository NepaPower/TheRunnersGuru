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

// `hidden: true` tabs stay fully built but aren't shown or reachable —
// Leaderboard and Challenges still run on hardcoded placeholder data
// (src/data/constants.ts), not real users. Flip the flag to bring one back.
const TABS: { id: ProfileTab; label: string; hidden?: boolean }[] = [
  { id: 'stats', label: 'Stats' },
  { id: 'leaderboard', label: 'Leaderboard', hidden: true },
  { id: 'challenges', label: 'Challenges', hidden: true },
  { id: 'settings', label: 'Settings' },
];

const VISIBLE_TABS = TABS.filter((t) => !t.hidden);
const isVisibleTab = (id: ProfileTab) => VISIBLE_TABS.some((t) => t.id === id);

export function Profile() {
  const { state, dispatch } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Support deep-linking into a specific tab, e.g. /profile?tab=settings
  // (used by the Dashboard's "Runner profile" button).
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && isVisibleTab(tab as ProfileTab)) {
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
        {VISIBLE_TABS.map((t) => (
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

      {(state.profileTab === 'stats' || !isVisibleTab(state.profileTab)) && <StatsTab />}
      {state.profileTab === 'leaderboard' && isVisibleTab('leaderboard') && <LeaderboardTab />}
      {state.profileTab === 'challenges' && isVisibleTab('challenges') && <ChallengesTab />}
      {state.profileTab === 'settings' && <SettingsTab />}
    </>
  );
}
