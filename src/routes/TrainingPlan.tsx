import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useApp } from '../state/AppContext';
import './trainingplan.css';

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

      <div className="rg-tp-header-card">
        <div className="rg-tp-header-top">
          <div className="rg-tp-race-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              <path d="M9 20l-5-2V4l5 2 6-2 5 2v14l-5-2-6 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 6v14M15 4v14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="rg-tp-race-name">Your training plan for {plan.raceName}</div>
          <div className="rg-tp-weeks">{plan.totalWeeks} week training plan</div>
          <div className="rg-tp-quote">"{plan.quote}"</div>
          <Button variant="secondary" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Collapse full plan' : 'Expand full plan'}
          </Button>
        </div>

        <div className="rg-tp-info-grid">
          <div>
            <div className="rg-tp-info-heading">
              <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                <path d="M4 17l5-6 4 4 7-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Phase Summary
            </div>
            <ul>
              {plan.phases.map((ph) => (
                <li key={ph.label}>
                  <strong>{ph.label}:</strong> {ph.title}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="rg-tp-info-heading">
              <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                <circle cx="12" cy="12" r="9" strokeWidth="2" />
                <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Key execution guidelines
            </div>
            <ul>
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
      </div>

      {expanded && (
        <div className="rg-tp-table-card">
          <div className="rg-tp-table-scroll">
            <table className="rg-tp-table">
              <thead>
                <tr>
                  {['Week', 'Phase / Focus', 'Mon', 'Tue (Intervals/Tempo)', 'Wed', 'Thu (Easy)', 'Fri', 'Sat (Long Run)', 'Sun', 'Total Weekly Miles'].map(
                    (h) => (
                      <th key={h}>{h}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row, i) => {
                  const rowClass = row.isRaceWeek ? 'rg-tp-race' : row.phase === 'Recovery Week' ? 'rg-tp-recovery' : '';
                  const bg = !row.isRaceWeek && row.phase !== 'Recovery Week' ? MONTH_BG[i % 2] : undefined;
                  return (
                    <tr key={row.week} className={rowClass} style={bg ? { background: bg } : undefined}>
                      <td style={{ fontWeight: 600 }}>{row.week}</td>
                      <td style={{ fontWeight: 600 }}>{row.phase}</td>
                      <td>{row.mon}</td>
                      <td>{row.tue}</td>
                      <td>{row.wed}</td>
                      <td>{row.thu}</td>
                      <td>{row.fri}</td>
                      <td style={{ fontWeight: 600 }}>{row.sat}</td>
                      <td>{row.sun}</td>
                      <td style={{ fontWeight: 600 }}>{row.totalMiles.toFixed(1)} Miles</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
