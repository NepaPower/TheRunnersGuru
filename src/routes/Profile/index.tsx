import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/PageHeader';
import { useApp } from '../../state/AppContext';
import { distanceGoalLabel, paceLabel } from '../../state/selectors';
import { signOut } from '../../lib/api';
import '../profile.css';
import type { ProfileTab } from '../../types';
import { StatsTab } from './StatsTab';
import { LeaderboardTab } from './LeaderboardTab';
import { ChallengesTab } from './ChallengesTab';
import { SettingsTab } from './SettingsTab';
import { BackgroundTab } from './BackgroundTab';

// `hidden: true` tabs stay fully built but aren't shown or reachable —
// Leaderboard and Challenges still run on hardcoded placeholder data
// (src/data/constants.ts), not real users. Flip the flag to bring one back.
const TABS: { id: ProfileTab; label: string; hidden?: boolean }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'background', label: 'History' },
  { id: 'stats', label: 'Stats' },
  { id: 'leaderboard', label: 'Leaderboard', hidden: true },
  { id: 'challenges', label: 'Challenges', hidden: true },
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

  // Describes the saved primary race. Someone with no race of their own (a
  // crew-only account) gets no line, rather than the wizard's default answers.
  const plan = state.trainingPlan;
  const planPace = plan ? paceLabel(plan) : null;
  const subtitle = plan ? [distanceGoalLabel(plan), planPace].filter(Boolean).join(' · ') : undefined;

  return (
    <>
      {/* The Log out action is the only reachable path to logging out on
          mobile now that the bottom tab bar replaced the hamburger's "Log
          out" button — desktop still also has the one in the top nav. */}
      <PageHeader
        eyebrow="Profile"
        title="Your profile"
        subtitle={subtitle}
        action={
          <Button variant="ghost" onClick={handleLogout}>
            Log out
          </Button>
        }
      />

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

      {state.profileTab === 'background' && <BackgroundTab />}
      {state.profileTab === 'stats' && <StatsTab />}
      {state.profileTab === 'leaderboard' && isVisibleTab('leaderboard') && <LeaderboardTab />}
      {state.profileTab === 'challenges' && isVisibleTab('challenges') && <ChallengesTab />}
      {(state.profileTab === 'settings' || !isVisibleTab(state.profileTab)) && <SettingsTab />}
    </>
  );
}
