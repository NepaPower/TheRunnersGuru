import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { SegOption } from '../components/ui/Form';
import { useApp } from '../state/AppContext';
import { getTrainingTimeWarning } from '../lib/planGenerator';
import { regeneratePlanWeeks } from '../lib/api';
import './trainingplan.css';

const MONTH_BG = ['var(--color-bg)', 'var(--color-neutral-100)'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Buckets a generated cell's free-text ("3 mi (Easy)", "Hill repeats — 30
 * min steady climbing", "RACE DAY — 26.2 mi") into a workout type so the
 * card view can color-code it consistently — same idea as Runna's
 * always-means-the-same-thing colored dots, learned once and holding
 * across every screen. */
function classifyWorkout(text: string): 'rest' | 'easy' | 'quality' | 'long' | 'cross' | 'strength' | 'race' | 'plain' {
  const t = text.toLowerCase();
  if (t.includes('race day')) return 'race';
  if (t === 'rest') return 'rest';
  if (t.includes('long run')) return 'long';
  if (t.includes('strength')) return 'strength';
  if (t.includes('bike') || t.includes('swim') || t.includes('cross')) return 'cross';
  if (t.includes('interval') || t.includes('tempo') || t.includes('hill') || t.includes('hiit') || t.includes('stairmaster')) return 'quality';
  if (t.includes('easy') || t.includes('shakeout')) return 'easy';
  return 'plain';
}

export function TrainingPlan() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const plan = state.trainingPlan;

  async function handleGenerate() {
    if (!plan?.id) return;
    setGenError(null);
    setGenerating(true);
    try {
      const patch = await regeneratePlanWeeks(plan);
      dispatch({ type: 'PLAN_PATCHED', planId: plan.id, patch });
      // Re-renders past the empty state now that plan.rows is populated.
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Could not generate the plan.');
      setGenerating(false);
    }
  }

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

  // A crew-only race (added via "My Races → Add a race") has no weekly
  // schedule. If it's been made the primary race, this screen has nothing
  // to show — point back to My Races.
  if (plan.rows.length === 0) {
    return (
      <>
        <Button variant="ghost" onClick={() => navigate('/home')} style={{ marginBottom: 'var(--space-4)' }}>
          ← Back to summary
        </Button>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>{plan.raceName}</h2>
        <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
          This race doesn't have a weekly training schedule yet — it was added for crew planning. Generate one now, or
          keep it crew-only and plan aid stations / pacing / weather on the Crew Plan.
        </p>
        {genError && (
          <div className="rg-auth-error" style={{ marginBottom: 'var(--space-4)' }}>
            {genError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button variant="primary" disabled={generating} onClick={handleGenerate}>
            {generating ? 'Generating…' : 'Generate training plan'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/crew-plan/${plan.id}`)}>
            Open Crew Plan
          </Button>
          <Button variant="ghost" onClick={() => navigate('/races')}>
            My Races
          </Button>
        </div>
      </>
    );
  }

  const isUltra = plan.distanceGoal === 'ultra';
  const timeWarning = getTrainingTimeWarning(plan.distanceGoal, plan.totalWeeks, plan.ultraMiles);
  const tableHeaders = isUltra
    ? ['Week', 'Phase / Focus', 'Mon', 'Tue (Hills/Climbing)', 'Wed (Strength)', 'Thu (Easy)', 'Fri (Cross-train)', 'Sat (Long Run 1)', 'Sun (Long Run 2)', 'Total Weekly Hours']
    : ['Week', 'Phase / Focus', 'Mon', 'Tue (Intervals/Tempo)', 'Wed', 'Thu (Easy)', 'Fri', 'Sat (Long Run)', 'Sun', 'Total Weekly Miles'];

  return (
    <>
      <Button variant="ghost" onClick={() => navigate('/home')} style={{ marginBottom: 'var(--space-4)' }}>
        ← Back to summary
      </Button>

      {timeWarning && (
        <div
          style={{
            border: '1px solid color-mix(in srgb, #d9a441 55%, transparent)',
            background: 'color-mix(in srgb, #d9a441 12%, transparent)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            borderRadius: 10,
            fontSize: 14,
          }}
        >
          ⚠ {timeWarning}
        </div>
      )}

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
            {isUltra ? (
              <ul>
                <li>
                  <strong>Back-to-back long runs:</strong> once Build Phase begins, Saturday and Sunday both carry a
                  long effort — Sunday is run on legs still tired from Saturday, which is what actually prepares you
                  for late-race fatigue rather than a single long run ever could.
                </li>
                <li>
                  <strong>Tuesday climbing:</strong> {plan.hillAccess === 'no' ? 'treadmill incline and StairMaster sessions' : 'hill repeats'} build the
                  eccentric quad strength and durability that descents demand — power-hiking the steep climbs is a
                  trained skill here, not a fallback.
                </li>
                <li>
                  <strong>Long run fueling:</strong> treat Saturday's long run as a rehearsal, not just training —
                  practice the real race-day carb intake (60–90g/hr) and hydration so your gut is trained
                  alongside your legs.
                </li>
                <li>
                  <strong>Strength and cross-training:</strong> the weekly strength session targets the durability
                  that resists breakdown over many hours, and the weekly bike/swim keeps blood flow moving on an
                  easy day without adding to the pounding.
                </li>
              </ul>
            ) : (
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
            )}
          </div>
        </div>

        <div className="rg-tp-expand-footer">
          <div className="seg">
            <SegOption name="tp-view" checked={view === 'cards'} onChange={() => setView('cards')} label="Card view" />
            <SegOption name="tp-view" checked={view === 'table'} onChange={() => setView('table')} label="Table view" />
          </div>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="rg-tp-week-list">
          {plan.rows.map((row) => {
            const cardClass = row.isRaceWeek ? 'rg-tp-race' : row.phase === 'Recovery Week' ? 'rg-tp-recovery' : '';
            const phaseClass = `rg-tp-phase-tag rg-tp-phase-${row.phase.replace(/\s+/g, '-').toLowerCase()}`;
            const days = [row.mon, row.tue, row.wed, row.thu, row.fri, row.sat, row.sun];
            return (
              <div key={row.week} className={`rg-tp-week-card ${cardClass}`}>
                <div className="rg-tp-week-card-head">
                  <span className="rg-tp-week-badge">{row.week}</span>
                  <span className={phaseClass}>{row.phase}</span>
                  <span className="rg-tp-week-total">
                    {isUltra && row.totalHours != null ? `${row.totalHours.toFixed(1)} hrs` : `${row.totalMiles.toFixed(1)} mi`}
                  </span>
                </div>
                <div className="rg-tp-week-days">
                  {days.map((text, i) => (
                    <div key={DAY_LABELS[i]} className="rg-tp-day-cell">
                      <div className="rg-tp-day-label">{DAY_LABELS[i]}</div>
                      <div className={`rg-tp-day-chip rg-tp-chip-${classifyWorkout(text)}`}>{text}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rg-tp-table-card">
          <div className="rg-tp-table-scroll">
            <table className="rg-tp-table">
              <thead>
                <tr>
                  {tableHeaders.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row, i) => {
                  const rowClass = row.isRaceWeek ? 'rg-tp-race' : row.phase === 'Recovery Week' ? 'rg-tp-recovery' : '';
                  const bg = !row.isRaceWeek && row.phase !== 'Recovery Week' ? MONTH_BG[i % 2] : undefined;
                  const phaseClass = `rg-tp-phase-tag rg-tp-phase-${row.phase.replace(/\s+/g, '-').toLowerCase()}`;
                  const dayCell = (value: string) => <td className={value === 'Rest' ? 'rg-tp-rest' : ''}>{value}</td>;
                  return (
                    <tr key={row.week} className={rowClass} style={bg ? { background: bg } : undefined}>
                      <td className="rg-tp-week-cell">
                        <span className="rg-tp-week-badge">{row.week}</span>
                      </td>
                      <td>
                        <span className={phaseClass}>{row.phase}</span>
                      </td>
                      {dayCell(row.mon)}
                      {dayCell(row.tue)}
                      {dayCell(row.wed)}
                      {dayCell(row.thu)}
                      {dayCell(row.fri)}
                      <td style={{ fontWeight: 600 }}>{row.sat}</td>
                      {dayCell(row.sun)}
                      <td className="rg-tp-total-cell">
                        {isUltra && row.totalHours != null ? `${row.totalHours.toFixed(1)} hrs` : `${row.totalMiles.toFixed(1)} mi`}
                      </td>
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
