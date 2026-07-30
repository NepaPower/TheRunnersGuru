import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Blueprint } from '../components/ui/Blueprint';
import { Button } from '../components/ui/Button';
import { useApp } from '../state/AppContext';

const MONTH_BG = ['var(--color-bg)', 'var(--color-neutral-100)'];

export function TrainingPlan() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const plan = state.trainingPlan;

  if (!plan) {
    return (
      <>
        <Button variant="ghost" onClick={() => navigate('/home')} style={{ marginBottom: 'var(--space-4)' }}>
          ← Back to summary
        </Button>
        <p className="text-muted">No training plan yet — finish onboarding to generate one.</p>
      </>
    );
  }

  return (
    <>
      <Button variant="ghost" onClick={() => navigate('/home')} style={{ marginBottom: 'var(--space-4)' }}>
        ← Back to summary
      </Button>

      <Blueprint style={{ border: '1px solid var(--color-divider)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 'var(--space-4)', gap: 'var(--space-2)' }}>
          <div className="card-kicker" style={{ fontSize: 20 }}>
            Your training plan for {plan.raceName}
          </div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {plan.totalWeeks} week training plan
          </div>
          <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--color-accent-700)', maxWidth: 480 }}>
            "{plan.quote}"
          </div>
          <Button variant="secondary" onClick={() => setExpanded((v) => !v)} style={{ marginTop: 'var(--space-2)' }}>
            {expanded ? 'Collapse full plan' : 'Expand full plan'}
          </Button>
        </div>

        <div
          style={{
            padding: '0 var(--space-4) var(--space-4)',
            borderTop: '1px solid var(--color-divider)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-4)',
          }}
        >
          <div>
            <h6 style={{ margin: 'var(--space-4) 0 var(--space-2)' }}>Phase Summary</h6>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {plan.phases.map((ph) => (
                <li key={ph.label}>
                  <strong>{ph.label}:</strong> {ph.title}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h6 style={{ margin: 'var(--space-4) 0 var(--space-2)' }}>Key execution guidelines</h6>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <li>
                <strong>The 10% rule:</strong> volume increments are capped carefully and paired with a recovery week
                every 4th week to shed accumulated systemic fatigue and allow tendon remodeling.
              </li>
              <li>
                <strong>Tuesday workouts:</strong> intervals focus on VO2 max upgrades (e.g. 4×800m or 5×1k repeats at
                5K/10K effort with jogging rest); tempo runs are sustained efforts at your Goal Marathon Pace (GMP) or
                lactate threshold to build muscular stamina.
              </li>
              <li>
                <strong>Saturday long runs:</strong> run at an easy, conversational effort — roughly 60 to 90 seconds
                slower per mile than goal race pace. Focus on time on your feet, zone 2 cardiovascular adaptation, and
                testing your nutrition/hydration protocol.
              </li>
            </ul>
          </div>
        </div>

        {expanded && (
          <div style={{ maxHeight: 520, overflow: 'auto', borderTop: '1px solid var(--color-divider)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, background: 'var(--color-accent-800)', color: 'var(--color-bg)', zIndex: 1 }}>
                  {['Week', 'Phase / Focus', 'Mon', 'Tue (Intervals/Tempo)', 'Wed', 'Thu (Easy)', 'Fri', 'Sat (Long Run)', 'Sun', 'Total Weekly Miles'].map(
                    (h) => (
                      <th key={h} style={{ padding: 8, textAlign: 'left' }}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row, i) => {
                  const bg = row.isRaceWeek
                    ? 'var(--color-accent-600)'
                    : row.phase === 'Recovery Week'
                      ? 'var(--color-accent-2-100)'
                      : MONTH_BG[i % 2];
                  const color = row.isRaceWeek ? 'var(--color-bg)' : 'var(--color-text)';
                  return (
                    <tr key={row.week} style={{ background: bg, color }}>
                      <td style={{ padding: 8, fontWeight: 600 }}>{row.week}</td>
                      <td style={{ padding: 8, fontWeight: 600 }}>{row.phase}</td>
                      <td style={{ padding: 8 }}>{row.mon}</td>
                      <td style={{ padding: 8 }}>{row.tue}</td>
                      <td style={{ padding: 8 }}>{row.wed}</td>
                      <td style={{ padding: 8 }}>{row.thu}</td>
                      <td style={{ padding: 8 }}>{row.fri}</td>
                      <td style={{ padding: 8, fontWeight: 600 }}>{row.sat}</td>
                      <td style={{ padding: 8 }}>{row.sun}</td>
                      <td style={{ padding: 8, fontWeight: 600 }}>{row.totalMiles.toFixed(1)} Miles</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Blueprint>
    </>
  );
}
