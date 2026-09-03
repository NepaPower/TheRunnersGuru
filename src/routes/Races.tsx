import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useApp } from '../state/AppContext';
import { deleteTrainingPlan } from '../lib/api';
import type { DistanceGoal } from '../types';
import './races.css';

const DISTANCE_LABEL: Record<DistanceGoal, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half marathon',
  full: 'Marathon',
  ultra: 'Ultra',
};

function daysUntil(isoDate: string): number | null {
  if (!isoDate) return null;
  const race = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(race.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((race.getTime() - today.getTime()) / 86_400_000);
}

function countdownLabel(days: number | null): string {
  if (days == null) return '';
  if (days < 0) return 'past';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 21) return `in ${days} days`;
  if (days < 90) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

export function Races() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plans = state.ownPlans;
  const hasMultiple = plans.length > 1;

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

  return (
    <>
      <div className="rg-races-header">
        <div>
          <h2 style={{ marginBottom: 0 }}>My Races</h2>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Every race you're planning for. Your primary race carries the weekly training plan; the rest are crew
            logistics only.
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/races/add')}>
          + Add a race
        </Button>
      </div>

      {error && (
        <div className="rg-auth-error" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
        </div>
      )}

      {plans.length === 0 ? (
        <div className="rg-races-empty">
          <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
            No races yet. Add one to start building its crew plan.
          </p>
          <Button variant="primary" onClick={() => navigate('/races/add')}>
            + Add a race
          </Button>
        </div>
      ) : (
        <div className="rg-races-list">
          {plans.map((p) => {
            const days = daysUntil(p.raceDate);
            const canDelete = !p.isPrimary || !hasMultiple;
            return (
              <div key={p.id} className="rg-races-card">
                <div className="rg-races-card-main">
                  <div className="rg-races-card-title">
                    {p.raceName}
                    {p.isPrimary && <span className="rg-races-badge">Primary</span>}
                  </div>
                  <div className="text-muted rg-races-card-meta">
                    {DISTANCE_LABEL[p.distanceGoal]}
                    {p.raceDate ? ` · ${p.raceDate}` : ''}
                    {days != null ? ` · ${countdownLabel(days)}` : ''}
                    {p.gpxRoute ? ` · ${p.gpxRoute.distanceMiles} mi course` : ''}
                  </div>
                </div>
                <div className="rg-races-card-actions">
                  {confirmId === p.id ? (
                    <>
                      <span className="text-muted" style={{ fontSize: 13 }}>
                        Delete this race? Anyone you've shared it with loses access. This can't be undone.
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
                      {canDelete ? (
                        <Button variant="ghost" onClick={() => setConfirmId(p.id ?? null)}>
                          Delete
                        </Button>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 12 }} title="Make another race primary first">
                          primary
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
