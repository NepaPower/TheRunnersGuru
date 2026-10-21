import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PageHeader, SectionHeader } from '../components/PageHeader';
import { SegOption } from '../components/ui/Form';
import { useApp } from '../state/AppContext';
import { getTrainingTimeWarning } from '../lib/planGenerator';
import { formatClockTime, formatRaceDateReadout } from '../lib/format';
import {
  displayWorkoutText,
  formatEasyRange,
  formatPace,
  goalAheadOfCurrentPace,
  trainingPacesFor,
  workoutDetail,
  workoutKind,
} from '../lib/trainingPaces';
import { regeneratePlanWeeks } from '../lib/api';
import { currentPlanWeek, dayNumberToISO, dayNumberToShort, localISODate, planDayISO, planWeekStart, weekRangeLabel } from '../lib/today';
import type { LoggedRun, TrainingPlan as TrainingPlanType, TrainingPlanRow } from '../types';
import { DISTANCE_LABELS } from '../data/constants';
import './trainingplan.css';

const MONTH_BG = ['var(--color-bg)', 'var(--color-neutral-100)'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Buckets a generated cell's free-text ("3 mi (Easy)", "Hill repeats — 30
 * min steady climbing", "RACE DAY — 26.2 mi") into a workout type so the
 * card view can color-code it consistently — same idea as Runna's
 * always-means-the-same-thing colored dots, learned once and holding
 * across every screen. */
function classifyWorkout(text: string): 'rest' | 'easy' | 'steady' | 'quality' | 'long' | 'cross' | 'strength' | 'race' | 'plain' {
  const t = text.toLowerCase();
  if (t.includes('race day')) return 'race';
  if (t === 'rest') return 'rest';
  if (t.includes('long run')) return 'long';
  if (t.includes('strength')) return 'strength';
  if (t.includes('bike') || t.includes('swim') || t.includes('cross')) return 'cross';
  if (t.includes('interval') || t.includes('tempo') || t.includes('hill') || t.includes('hiit') || t.includes('stairmaster')) return 'quality';
  if (t.includes('steady')) return 'steady';
  if (t.includes('easy') || t.includes('shakeout')) return 'easy';
  return 'plain';
}

const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const KIND_LABEL: Record<ReturnType<typeof classifyWorkout>, string> = {
  rest: 'Rest day',
  easy: 'Easy',
  steady: 'Steady',
  quality: 'Quality',
  long: 'Long run',
  cross: 'Cross-train',
  strength: 'Strength',
  race: 'Race day',
  plain: '',
};

/** Card view: one week open at a time in big day cards (this week by default),
 * with a slim list of every week below to jump to. Each past or current day can
 * be logged from here (opens Log a Run with the date and planned miles filled in). */
function TrainingWeeks({
  plan,
  isUltra,
  dayInfo,
  loggedRuns,
  onLog,
}: {
  plan: TrainingPlanType;
  isUltra: boolean;
  dayInfo: (row: TrainingPlanRow, dayIndex: number, raw: string) => { text: string; detail: string | null };
  loggedRuns: LoggedRun[];
  onLog: (iso: string, raw: string) => void;
}) {
  const currentWeek = currentPlanWeek(plan);
  const [selected, setSelected] = useState<number | null>(null);
  // Weeks whose seven-day strip is unfolded in the list below (none by default).
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const todayISO = localISODate();

  const activeWeek = selected ?? currentWeek;
  const idx = Math.max(0, plan.rows.findIndex((r) => r.week === activeWeek));
  const row = plan.rows[idx];

  const weekTotal = (r: TrainingPlanRow) =>
    isUltra && r.totalHours != null ? `${r.totalHours.toFixed(1)} hrs` : `${r.totalMiles.toFixed(1)} mi`;
  const phaseTag = (r: TrainingPlanRow) => `rg-tp-phase-tag rg-tp-phase-${r.phase.replace(/\s+/g, '-').toLowerCase()}`;
  const weekClass = (r: TrainingPlanRow) => (r.isRaceWeek ? 'rg-tp-race' : r.phase === 'Recovery Week' ? 'rg-tp-recovery' : '');
  const rangeFor = (week: number) => {
    const start = planWeekStart(plan, week);
    return start == null ? '' : weekRangeLabel(start);
  };
  /** Miles logged on the days of a plan week. */
  const loggedMiles = (week: number) => {
    const start = planWeekStart(plan, week);
    if (start == null) return 0;
    const days = new Set(Array.from({ length: 7 }, (_, i) => dayNumberToISO(start + i)));
    return loggedRuns.filter((r) => days.has(r.date)).reduce((sum, r) => sum + (parseFloat(r.distance) || 0), 0);
  };

  const allExpanded = expanded.size === plan.rows.length;
  const toggleWeek = (week: number) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (!next.delete(week)) next.add(week);
      return next;
    });

  function pick(week: number) {
    setSelected(week);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  const days = [row.mon, row.tue, row.wed, row.thu, row.fri, row.sat, row.sun];
  const weekStart = planWeekStart(plan, row.week);

  return (
    <>
      <div ref={panelRef} className={`rg-tp-weekpanel ${weekClass(row)}`}>
        <div className="rg-tp-weekpanel-head">
          <button
            type="button"
            className="rg-tp-weeknav"
            aria-label="Previous week"
            disabled={idx <= 0}
            onClick={() => setSelected(plan.rows[idx - 1].week)}
          >
            ‹
          </button>
          <div className="rg-tp-weekpanel-title">
            <div className="rg-tp-weekpanel-kicker">
              Week {row.week} of {plan.totalWeeks}
              {row.week === currentWeek ? ' · This week' : ''}
            </div>
            <div className="rg-tp-weekpanel-main">
              <span className={phaseTag(row)}>{row.phase}</span>
              <span>{rangeFor(row.week)}</span>
            </div>
          </div>
          <div className="rg-tp-weekpanel-total">{weekTotal(row)}</div>
          <button
            type="button"
            className="rg-tp-weeknav"
            aria-label="Next week"
            disabled={idx >= plan.rows.length - 1}
            onClick={() => setSelected(plan.rows[idx + 1].week)}
          >
            ›
          </button>
        </div>

        <div className="rg-tp-daygrid">
          {days.map((raw, i) => {
            const { text, detail } = dayInfo(row, i, raw);
            const kind = classifyWorkout(text);
            const iso = planDayISO(plan, row.week, i);
            const runs = iso ? loggedRuns.filter((r) => r.date === iso) : [];
            const canLog = iso != null && iso <= todayISO;
            return (
              <div key={DAY_FULL[i]} className={`rg-tp-daycard rg-tp-kind-${kind}${iso === todayISO ? ' is-today' : ''}`}>
                <div className="rg-tp-daycard-top">
                  <span className="rg-tp-daycard-day">{DAY_FULL[i]}</span>
                  <span className="rg-tp-daycard-date">{weekStart != null ? dayNumberToShort(weekStart + i) : ''}</span>
                </div>
                {KIND_LABEL[kind] && <div className="rg-tp-daycard-kind">{KIND_LABEL[kind]}</div>}
                <div className="rg-tp-daycard-text">{text}</div>
                {detail && <div className="rg-tp-daycard-detail">{detail}</div>}
                {runs.map((r) => (
                  <div key={r.id} className="rg-tp-daycard-done">
                    ✓ {parseFloat(r.distance) || r.distance} mi{r.paceLabel ? ` · ${r.paceLabel}/mi` : ''}
                  </div>
                ))}
                {canLog && (
                  <button type="button" className="rg-tp-daycard-log" onClick={() => onLog(iso, raw)}>
                    {runs.length > 0 ? 'Log another run' : 'Log run'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rg-tp-weeklist-head">
        <span>All weeks</span>
        <button
          type="button"
          className="rg-tp-link"
          onClick={() => setExpanded(allExpanded ? new Set() : new Set(plan.rows.map((r) => r.week)))}
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <div className="rg-tp-weeklist">
        {plan.rows.map((r) => {
          const logged = loggedMiles(r.week);
          const open = expanded.has(r.week);
          const rowDays = [r.mon, r.tue, r.wed, r.thu, r.fri, r.sat, r.sun];
          return (
            <div key={r.week} className={`rg-tp-weekitem ${weekClass(r)}${r.week === activeWeek ? ' is-active' : ''}`}>
              <div className="rg-tp-weekitem-bar">
                <button type="button" className="rg-tp-weekrow" onClick={() => pick(r.week)}>
                  <span className="rg-tp-week-badge">{r.week}</span>
                  <span className={phaseTag(r)}>{r.phase}</span>
                  <span className="rg-tp-weekrow-dates">{rangeFor(r.week)}</span>
                  {r.week === currentWeek && <span className="rg-tp-now">This week</span>}
                  {logged > 0 && <span className="rg-tp-weekrow-logged">✓ {logged.toFixed(1)} mi logged</span>}
                  <span className="rg-tp-weekrow-total">{weekTotal(r)}</span>
                </button>
                <button
                  type="button"
                  className="rg-tp-weekrow-toggle"
                  aria-expanded={open}
                  aria-label={`${open ? 'Collapse' : 'Expand'} week ${r.week}`}
                  onClick={() => toggleWeek(r.week)}
                >
                  {open ? '▴' : '▾'}
                </button>
              </div>
              {open && (
                <div className="rg-tp-week-days rg-tp-weekitem-days">
                  {rowDays.map((raw, i) => {
                    const { text, detail } = dayInfo(r, i, raw);
                    return (
                      <div key={DAY_LABELS[i]} className="rg-tp-day-cell">
                        <div className="rg-tp-day-label">{DAY_LABELS[i]}</div>
                        <div className={`rg-tp-day-chip rg-tp-chip-${classifyWorkout(text)}`}>{text}</div>
                        {detail && <div className="rg-tp-day-detail">{detail}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function TrainingPlan() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const plan = state.trainingPlan;

  /** Logs a run from the plan: Log a Run opens with the day's date, and the planned miles if the day has any. */
  function logFromPlan(iso: string, raw: string) {
    const miles = /(\d+(?:\.\d+)?)\s*mi\b/.exec(raw);
    dispatch({ type: 'LOG_FORM_SET_MANY', fields: { date: iso, ...(miles ? { distance: miles[1] } : {}) } });
    navigate('/log-run');
  }

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
  const timeWarning = getTrainingTimeWarning(plan.distanceGoal, plan.totalWeeks, plan.ultraMiles, {
    base: { weeklyMiles: plan.currentWeeklyMiles ?? null, longestRunMiles: plan.longestRunMiles ?? null },
    firstTime: plan.firstTime,
  });
  const distanceLabel = isUltra
    ? plan.ultraMiles
      ? `${plan.ultraMiles}-Mile Ultra`
      : DISTANCE_LABELS.ultra
    : DISTANCE_LABELS[plan.distanceGoal];
  // Training paces for standard-distance plans, from the goal finish time.
  // Computed here at render time (not stored) so changing the goal on Edit
  // Race updates every workout's pace immediately, with no plan rebuild.
  const paceUnit = plan.paceUnit === 'km' ? 'km' : 'mi';
  const paces = isUltra ? null : trainingPacesFor(plan.distanceGoal, plan.goalFinishMinutes);
  const goalAhead = isUltra ? null : goalAheadOfCurrentPace(plan);
  const goalLabel = plan.goalFinishMinutes ? formatClockTime(plan.goalFinishMinutes * 60) : '';
  const editGoal = () => plan.id && navigate(`/races/${plan.id}/edit`);
  /** A day's shown text + its pace guidance (null for ultras / no goal). */
  const dayInfo = (row: (typeof plan.rows)[number], dayIndex: number, raw: string) => {
    if (isUltra) return { text: raw, detail: null as string | null };
    const kind = workoutKind(dayIndex, raw, row.isRaceWeek);
    return {
      text: displayWorkoutText(dayIndex, raw, kind),
      detail: paces ? workoutDetail(kind, raw, { distanceGoal: plan.distanceGoal, phase: row.phase, paces, unit: paceUnit }) : null,
    };
  };
  // Short-runway ultra plans swap the hill and cross-train days for gear and fuel rehearsal.
  const isReadiness = plan.rows.some((r) => r.phase === 'Race Prep');
  const tableHeaders = isReadiness && isUltra
    ? ['Week', 'Phase / Focus', 'Mon', 'Tue (Gear test)', 'Wed (Strength)', 'Thu (Easy)', 'Fri (Fuel rehearsal)', 'Sat (Long Run)', 'Sun', 'Total Weekly Hours']
    : isReadiness
    ? ['Week', 'Phase / Focus', 'Mon', 'Tue (Easy)', 'Wed (Steady)', 'Thu (Easy)', 'Fri', 'Sat (Long Run)', 'Sun', 'Total Weekly Miles']
    : isUltra
    ? ['Week', 'Phase / Focus', 'Mon', 'Tue (Hills/Climbing)', 'Wed (Strength)', 'Thu (Easy)', 'Fri (Cross-train)', 'Sat (Long Run 1)', 'Sun (Long Run 2)', 'Total Weekly Hours']
    : ['Week', 'Phase / Focus', 'Mon', 'Tue (Intervals/Tempo)', 'Wed (Steady)', 'Thu (Easy)', 'Fri', 'Sat (Long Run)', 'Sun', 'Total Weekly Miles'];

  return (
    <>
      <Button variant="ghost" onClick={() => navigate('/home')} style={{ marginBottom: 'var(--space-4)' }}>
        ← Back to summary
      </Button>

      <PageHeader
        eyebrow="Training plan"
        title={plan.raceName}
        insight={`${plan.totalWeeks}-week plan`}
        subtitle={`${distanceLabel}${plan.raceDate ? ` · Race day: ${formatRaceDateReadout(plan.raceDate)}` : ''}`}
      />

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
          {plan.id && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <button type="button" className="rg-tp-link" onClick={editGoal}>
                Fitness changed? Update my current running
              </button>
            </div>
          )}
        </div>
      )}

      <div className="rg-tp-header-card">
        <div className="rg-tp-header-top">
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
            {isReadiness ? (
              // Hold-and-taper plan: the standard guidance (back-to-backs, hill repeats, the 10% rule's
              // build, intervals and tempo) describes a build this plan deliberately doesn't do.
              <ul>
                <li>
                  <strong>Hold, don't build:</strong> your long run stays at or below your current longest run. With
                  this much time, adding distance or intensity costs more in injury risk than it gains. The goal now is
                  to arrive healthy and rehearsed.
                </li>
                {isUltra ? (
                  <>
                    <li>
                      <strong>Gear test runs:</strong> run in the exact shoes, pack and clothing you'll race in, on
                      race-like terrain. Find the blister, chafe and fit problems now, not at mile 40. Nothing new in
                      the last two weeks.
                    </li>
                    <li>
                      <strong>Fuel rehearsal:</strong> eat and drink on your race-day schedule (60–90g carbs an hour)
                      on the Friday session and your long run, so your gut is trained alongside your legs.
                    </li>
                    <li>
                      <strong>Use your Crew Plan:</strong> cutoff pace, drop bags and crew logistics are where the time
                      you have left pays off most.
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <strong>Easy running only:</strong> every run stays easy or steady. Intervals and tempo add
                      injury risk without the weeks needed to adapt to them.
                    </li>
                    <li>
                      <strong>Rehearse race day:</strong> practise your fuelling, a conservative first miles pace, and
                      your race shoes and kit on the long run. Nothing new on race day.
                    </li>
                  </>
                )}
                <li>
                  <strong>Taper and sleep:</strong> the last weeks step down on purpose. Protect your sleep, and treat
                  rest days as part of the plan.
                </li>
              </ul>
            ) : isUltra ? (
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
      </div>

      {!isUltra && (
        <div className="rg-tp-pace-card">
          {paces ? (
            <>
              <div className="rg-tp-info-heading">Your training paces</div>
              <div className="rg-tp-pace-grid">
                <div><span>Easy</span><strong>{formatEasyRange(paces, paceUnit)}</strong></div>
                <div><span>Steady</span><strong>{formatPace(paces.steady, paceUnit)}</strong></div>
                <div><span>Tempo</span><strong>{formatPace(paces.tempo, paceUnit)}</strong></div>
                <div><span>Intervals</span><strong>{formatPace(paces.interval, paceUnit)}</strong></div>
                <div><span>Race pace</span><strong>{formatPace(paces.race, paceUnit)}</strong></div>
              </div>
              <p className="rg-tp-pace-note">
                Based on your <strong>{goalLabel}</strong> {DISTANCE_LABELS[plan.distanceGoal]} goal.{' '}
                <button type="button" className="rg-tp-link" onClick={editGoal}>Change goal</button>
              </p>
              {goalAhead && (
                <p className="rg-tp-pace-warning">
                  Your goal is well ahead of your current pace — at {plan.customPace}/{paceUnit} you would run a{' '}
                  {DISTANCE_LABELS[plan.distanceGoal]} in about {formatClockTime(goalAhead.currentSeconds)}. Many runners
                  train a little slower at first and move toward goal pace as fitness builds. You can change your goal any
                  time.
                </p>
              )}
              <p className="rg-tp-pace-note">
                Estimates only — adjust for heat, hills and fatigue. Easy runs should feel conversational.
              </p>
            </>
          ) : (
            <p className="rg-tp-pace-note" style={{ margin: 0 }}>
              Add a goal finish time to see training paces for every workout.{' '}
              <button type="button" className="rg-tp-link" onClick={editGoal}>Add goal time</button>
            </p>
          )}
        </div>
      )}

      <SectionHeader
        title="Week by week"
        status={`${plan.totalWeeks} weeks`}
        action={
          <div className="seg">
            <SegOption name="tp-view" checked={view === 'cards'} onChange={() => setView('cards')} label="Card view" />
            <SegOption name="tp-view" checked={view === 'table'} onChange={() => setView('table')} label="Table view" />
          </div>
        }
      />

      {view === 'cards' ? (
        <TrainingWeeks plan={plan} isUltra={isUltra} dayInfo={dayInfo} loggedRuns={state.loggedRuns} onLog={logFromPlan} />
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
                  const dayCell = (value: string, dayIndex: number) => {
                    const { text, detail } = dayInfo(row, dayIndex, value);
                    return (
                      <td className={value === 'Rest' ? 'rg-tp-rest' : ''}>
                        {text}
                        {detail && <div className="rg-tp-day-detail">{detail}</div>}
                      </td>
                    );
                  };
                  const satInfo = dayInfo(row, 5, row.sat);
                  return (
                    <tr key={row.week} className={rowClass} style={bg ? { background: bg } : undefined}>
                      <td className="rg-tp-week-cell">
                        <span className="rg-tp-week-badge">{row.week}</span>
                      </td>
                      <td>
                        <span className={phaseClass}>{row.phase}</span>
                      </td>
                      {dayCell(row.mon, 0)}
                      {dayCell(row.tue, 1)}
                      {dayCell(row.wed, 2)}
                      {dayCell(row.thu, 3)}
                      {dayCell(row.fri, 4)}
                      <td style={{ fontWeight: 600 }}>
                        {satInfo.text}
                        {satInfo.detail && <div className="rg-tp-day-detail">{satInfo.detail}</div>}
                      </td>
                      {dayCell(row.sun, 6)}
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
