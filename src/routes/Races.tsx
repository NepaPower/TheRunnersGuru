import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { RaceResultBox } from '../components/RaceResultBox';
import { EmptyState, PageHeader, SectionHeader } from '../components/PageHeader';
import { useApp } from '../state/AppContext';
import { deleteTrainingPlan, fetchCrewAccessList, regeneratePlanWeeks, setPrimaryRace } from '../lib/api';
import { countdownLabel, daysUntil, isRaceLocked } from '../lib/today';
import type { CrewAccessEntry, DistanceGoal } from '../types';
import './races.css';

const DISTANCE_LABEL: Record<DistanceGoal, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half marathon',
  full: 'Marathon',
  ultra: 'Ultra',
};

function agoLabel(daysAgo: number): string {
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo < 60) return `${daysAgo} days ago`;
  return `${Math.round(daysAgo / 30)} months ago`;
}

export function Races() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Crew list per plan, fetched lazily when the delete confirm opens so
  // it can name who loses access. undefined = not fetched, null = fetch
  // failed / still loading.
  const [crewByPlan, setCrewByPlan] = useState<Record<string, CrewAccessEntry[] | null>>({});

  const plans = state.ownPlans;
  const hasMultiple = plans.length > 1;

  function openDeleteConfirm(planId: string) {
    setConfirmId(planId);
    if (!(planId in crewByPlan)) {
      setCrewByPlan((prev) => ({ ...prev, [planId]: null }));
      fetchCrewAccessList(planId)
        .then((list) => setCrewByPlan((prev) => ({ ...prev, [planId]: list })))
        .catch(() => setCrewByPlan((prev) => ({ ...prev, [planId]: [] })));
    }
  }

  async function handleDelete(planId: string) {
    setError(null);
    setDeletingId(planId);
    try {
      await deleteTrainingPlan(planId);
      dispatch({ type: 'PLAN_DELETED', planId });
      setConfirmId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that race.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMakePrimary(planId: string) {
    if (!state.userId) return;
    setError(null);
    setPrimaryId(planId);
    try {
      await setPrimaryRace(state.userId, planId);
      dispatch({ type: 'PRIMARY_CHANGED', planId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change your primary race.');
    } finally {
      setPrimaryId(null);
    }
  }

  async function handleGeneratePlan(planId: string) {
    const target = plans.find((p) => p.id === planId);
    if (!target) return;
    setError(null);
    setGeneratingId(planId);
    try {
      const patch = await regeneratePlanWeeks(target);
      dispatch({ type: 'PLAN_PATCHED', planId, patch });
      navigate('/training-plan');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the plan.');
    } finally {
      setGeneratingId(null);
    }
  }

  const upcomingDays = plans.map((p) => daysUntil(p.raceDate)).filter((d): d is number => d != null && d >= 0);
  // "On your calendar" means races still ahead; finished ones are counted separately.
  const completedCount = plans.filter((p) => {
    const d = daysUntil(p.raceDate);
    return d != null && d < 0;
  }).length;
  const onCalendar = plans.length - completedCount;
  const calendarInsight =
    `${onCalendar === 0 ? 'No races' : `${onCalendar} race${onCalendar === 1 ? '' : 's'}`} on your calendar` +
    (completedCount > 0 ? ` · ${completedCount} completed` : '');
  const nextRaceStatus = upcomingDays.length > 0 ? `Next race ${countdownLabel(Math.min(...upcomingDays))}` : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Races"
        title="My Races"
        insight={plans.length > 0 ? calendarInsight : undefined}
        subtitle={
          <>
            Every race you're planning for. Only your <strong>primary</strong> race gets a weekly training plan — make a
            race primary to generate one. The rest are crew logistics only.
          </>
        }
        action={
          <Button variant="primary" onClick={() => navigate('/races/add')}>
            + Add a race
          </Button>
        }
      />

      {error && (
        <div className="rg-auth-error" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      {plans.length > 0 && <SectionHeader title="Your races" status={nextRaceStatus} />}

      {plans.length === 0 ? (
        <EmptyState
          title="No races on the calendar yet."
          action={
            <Button variant="primary" onClick={() => navigate('/races/add')}>
              + Add a race
            </Button>
          }
        >
          Add one to start building its crew plan.
        </EmptyState>
      ) : (
        <div className="rg-races-list">
          {plans.map((p) => {
            const days = daysUntil(p.raceDate);
            const isPast = days != null && days < 0;
            const locked = isRaceLocked(p.raceDate, p.createdAt);
            const canDelete = !p.isPrimary || !hasMultiple;
            return (
              <div key={p.id} className="rg-races-card">
                <div className="rg-races-card-main">
                  <div className="rg-races-card-title">
                    {p.raceName}
                    {p.isPrimary && <span className="rg-races-badge">Primary</span>}
                    {isPast && <span className="rg-races-badge rg-races-badge-done">Completed</span>}
                  </div>
                  <div className="text-muted rg-races-card-meta">
                    {DISTANCE_LABEL[p.distanceGoal]}
                    {p.raceDate ? ` · ${p.raceDate}` : ''}
                    {days != null ? ` · ${isPast ? agoLabel(-days) : countdownLabel(days)}` : ''}
                    {p.gpxRoute ? ` · ${p.gpxRoute.distanceMiles} mi course` : ''}
                  </div>
                </div>
                <div className="rg-races-card-actions">
                  {confirmId === p.id ? (
                    <>
                      <span className="text-muted" style={{ fontSize: 13 }}>
                        {(() => {
                          const crew = p.id ? crewByPlan[p.id] : undefined;
                          if (crew === undefined || crew === null) return 'Delete this race? This can’t be undone.';
                          if (crew.length === 0) return 'Delete this race? This can’t be undone.';
                          const names = crew.map((c) => c.invitedEmail).join(', ');
                          return `Delete this race? ${crew.length} crew member${crew.length === 1 ? '' : 's'} lose access (${names}). This can’t be undone.`;
                        })()}
                      </span>
                      <Button variant="ghost" disabled={deletingId === p.id} onClick={() => p.id && handleDelete(p.id)}>
                        {deletingId === p.id ? 'Deleting…' : 'Yes, delete'}
                      </Button>
                      <Button variant="ghost" disabled={deletingId === p.id} onClick={() => setConfirmId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="primary" onClick={() => navigate(`/crew-plan/${p.id}`)}>
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={locked}
                        title={locked ? 'Locked — this race ended more than 14 days ago' : undefined}
                        onClick={() => navigate(`/races/${p.id}/edit`)}
                      >
                        Edit
                      </Button>
                      {p.isPrimary && p.rows.length === 0 && !isPast && (
                        <Button
                          variant="ghost"
                          disabled={generatingId === p.id}
                          onClick={() => p.id && handleGeneratePlan(p.id)}
                        >
                          {generatingId === p.id ? 'Generating…' : 'Generate plan'}
                        </Button>
                      )}
                      {!p.isPrimary && !isPast && (
                        <Button
                          variant="ghost"
                          disabled={primaryId === p.id}
                          onClick={() => p.id && handleMakePrimary(p.id)}
                        >
                          {primaryId === p.id ? 'Setting…' : 'Make primary'}
                        </Button>
                      )}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          disabled={locked}
                          title={locked ? 'Locked — this race ended more than 14 days ago' : undefined}
                          onClick={() => p.id && openDeleteConfirm(p.id)}
                        >
                          Delete
                        </Button>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 12 }} title="Make another race primary to delete this one">
                          can't delete primary
                        </span>
                      )}
                    </>
                  )}
                </div>
                {isPast && p.id && (
                  <RaceResultBox
                    planId={p.id}
                    result={p.raceResult}
                    finishSeconds={p.raceFinishSeconds}
                    milesCompleted={p.raceMilesCompleted}
                    dnfReason={p.raceDnfReason}
                    note={p.raceResultNote}
                    onSaved={(patch) => dispatch({ type: 'PLAN_PATCHED', planId: p.id as string, patch })}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
