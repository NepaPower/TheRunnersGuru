import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, TextArea } from '../../components/ui/Form';
import { useApp } from '../../state/AppContext';
import {
  deleteInjury,
  deletePastRace,
  fetchInjuries,
  fetchPastRaces,
  insertInjury,
  insertPastRace,
  updateInjury,
  updatePastRace,
} from '../../lib/api';
import { formatFinishTime } from '../../lib/format';
import { daysUntil, localISODate } from '../../lib/today';
import { distanceGoalLabel } from '../../state/selectors';
import type { Injury, InjuryCause, PastRace, RaceResult } from '../../types';

const DISTANCE_SUGGESTIONS = ['5K', '10K', 'Half marathon', 'Marathon', '50K', '50 miles', '100K', '100 miles', '200 miles'];
const AREA_SUGGESTIONS = ['Knee', 'Ankle', 'Achilles', 'Shin', 'Calf', 'Hamstring', 'Quad', 'Hip', 'IT band', 'Plantar fascia', 'Foot', 'Lower back'];

const CAUSE_OPTIONS: { value: Exclude<InjuryCause, ''>; label: string }[] = [
  { value: 'race', label: 'During a race' },
  { value: 'training', label: 'During training' },
  { value: 'other', label: 'Not from running' },
  { value: 'unsure', label: 'Not sure' },
];
const causeLabel = (c: InjuryCause) => CAUSE_OPTIONS.find((o) => o.value === c)?.label ?? '';

const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatMonth = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

/** Profile → Background: races the runner has already run, and current / past injuries.
 * Both lists are private to the account (owner-only in the database): crew and other
 * runners never see them. */
export function BackgroundTab() {
  const { state } = useApp();
  const userId = state.userId;
  const [races, setRaces] = useState<PastRace[] | null>(null);
  const [injuries, setInjuries] = useState<Injury[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([fetchPastRaces(userId), fetchInjuries(userId)])
      .then(([r, i]) => {
        if (cancelled) return;
        setRaces(r);
        setInjuries(i);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) return null;

  if (loadError) {
    return (
      <div className="rg-card stack-3">
        <h3 style={{ margin: 0 }}>Running background</h3>
        <div className="rg-auth-error">We couldn't load your running background. {loadError}</div>
      </div>
    );
  }

  return (
    <div className="rg-pf-cols">
      <div className="rg-pf-col">
        <PastRaces userId={userId} races={races} onChange={setRaces} />
      </div>
      <div className="rg-pf-col">
        <Injuries userId={userId} injuries={injuries} onChange={setInjuries} />
      </div>
    </div>
  );
}

// ─── Past races ──────────────────────────────────────────────────────────

interface RaceDraft {
  name: string;
  date: string;
  distance: string;
  hours: string;
  minutes: string;
  seconds: string;
  result: 'finished' | 'dnf';
  notes: string;
}

const EMPTY_RACE: RaceDraft = { name: '', date: '', distance: '', hours: '', minutes: '', seconds: '', result: 'finished', notes: '' };

function draftFromRace(r: PastRace): RaceDraft {
  const t = r.finishSeconds ?? 0;
  return {
    name: r.name,
    date: r.date,
    distance: r.distance,
    hours: r.finishSeconds ? String(Math.floor(t / 3600)) : '',
    minutes: r.finishSeconds ? String(Math.floor((t % 3600) / 60)) : '',
    seconds: r.finishSeconds ? String(t % 60) : '',
    result: r.result,
    notes: r.notes,
  };
}

const digits = (v: string) => v.replace(/[^\d]/g, '');

/** One row in the Past races list: either something the runner added here, or a race from
 * My Races whose date has passed (shown here without copying it, whatever its result,
 * including none yet). */
type PastRaceItem =
  | { kind: 'manual'; date: string; race: PastRace }
  | { kind: 'plan'; date: string; id: string; name: string; distance: string; finishSeconds: number | null; result: RaceResult | null };

const PLAN_RESULT_BADGE: Record<RaceResult, { label: string; cls: string }> = {
  finished: { label: 'Finished', cls: 'rg-pf-badge-current' },
  dnf: { label: 'Did not finish', cls: 'rg-pf-badge-dnf' },
  dns: { label: 'Did not start', cls: 'rg-pf-badge-dnf' },
  cancelled: { label: 'Cancelled', cls: 'rg-pf-badge-past' },
};

function PastRaces({ userId, races, onChange }: { userId: string; races: PastRace[] | null; onChange: (r: PastRace[]) => void }) {
  const { state } = useApp();
  const navigate = useNavigate();
  // Every race in My Races whose date has passed is listed here, whatever its result.
  const fromPlans: PastRaceItem[] = state.ownPlans
    .filter((p) => p.id && p.raceDate && (daysUntil(p.raceDate) ?? 0) < 0)
    .map((p) => ({
      kind: 'plan' as const,
      date: p.raceDate,
      id: p.id as string,
      name: p.raceName,
      distance: distanceGoalLabel(p),
      finishSeconds: p.raceFinishSeconds ?? null,
      result: p.raceResult ?? null,
    }));
  const merged: PastRaceItem[] = [...(races ?? []).map((r): PastRaceItem => ({ kind: 'manual', date: r.date, race: r })), ...fromPlans].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  // editingId: null = form closed, 'new' = adding, otherwise the race being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RaceDraft>(EMPTY_RACE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const today = localISODate();

  const set = <K extends keyof RaceDraft>(key: K, value: RaceDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function openNew() {
    setDraft(EMPTY_RACE);
    setError(null);
    setEditingId('new');
  }
  function openEdit(r: PastRace) {
    setDraft(draftFromRace(r));
    setError(null);
    setEditingId(r.id);
  }

  async function save() {
    if (!races) return;
    const name = draft.name.trim();
    const distance = draft.distance.trim();
    if (!name || !distance || !draft.date) {
      setError('Add the race name, date and distance.');
      return;
    }
    if (draft.date > today) {
      setError('This is for races you have already run. Add upcoming races under My Races.');
      return;
    }
    const seconds = (Number(draft.hours) || 0) * 3600 + (Number(draft.minutes) || 0) * 60 + (Number(draft.seconds) || 0);
    const input = {
      name,
      date: draft.date,
      distance,
      finishSeconds: seconds > 0 ? seconds : null,
      result: draft.result,
      notes: draft.notes,
    };
    setSaving(true);
    setError(null);
    try {
      if (editingId === 'new') {
        const created = await insertPastRace(userId, input);
        onChange([created, ...races].sort((a, b) => b.date.localeCompare(a.date)));
      } else if (editingId) {
        const updated = await updatePastRace(editingId, input);
        onChange(races.map((r) => (r.id === updated.id ? updated : r)).sort((a, b) => b.date.localeCompare(a.date)));
      }
      setEditingId(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!races) return;
    setError(null);
    try {
      await deletePastRace(id);
      onChange(races.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="rg-card stack-3">
      <div className="row-3">
        <div className="rg-card-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path d="M5 21V4M5 4h11l-2 4 2 4H5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Past races</h3>
          <p className="text-muted" style={{ margin: 0, fontSize: 13.5 }}>
            Your race history, including races from My Races. Private to you.
          </p>
        </div>
      </div>

      {races == null ? (
        <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
          Loading…
        </p>
      ) : (
        <>
          {merged.length === 0 && editingId == null && (
            <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
              No past races yet. Add the ones you are proud of, especially the long ones.
            </p>
          )}

          {merged.length > 0 && (
            <div className="rg-pf-list">
              {merged.map((m) => {
                if (m.kind === 'plan') {
                  return (
                    <div key={'plan-' + m.id} className="rg-pf-item">
                      <div className="rg-pf-item-main">
                        <div className="rg-pf-item-title">{m.name}</div>
                        <div className="rg-pf-item-meta">
                          {[formatDate(m.date), m.distance, m.finishSeconds ? formatFinishTime(m.finishSeconds) : null].filter(Boolean).join(' · ')}
                          {m.result && m.result !== 'finished' && (
                            <span className={`rg-pf-badge ${PLAN_RESULT_BADGE[m.result].cls}`}>{PLAN_RESULT_BADGE[m.result].label}</span>
                          )}
                          {!m.result && <span className="rg-pf-badge rg-pf-badge-current">No result yet</span>}
                          <span className="rg-pf-badge rg-pf-badge-past">From My Races</span>
                        </div>
                      </div>
                      <div className="rg-pf-item-actions">
                        <Button variant="ghost" onClick={() => navigate('/races')}>
                          {m.result ? 'Edit in My Races' : 'Add result'}
                        </Button>
                      </div>
                    </div>
                  );
                }
                const r = m.race;
                return (
                <div key={r.id} className="rg-pf-item">
                  <div className="rg-pf-item-main">
                    <div className="rg-pf-item-title">{r.name}</div>
                    <div className="rg-pf-item-meta">
                      {[formatDate(r.date), r.distance, r.finishSeconds ? formatFinishTime(r.finishSeconds) : null].filter(Boolean).join(' · ')}
                      {r.result === 'dnf' && <span className="rg-pf-badge rg-pf-badge-dnf">Did not finish</span>}
                    </div>
                    {r.notes && <div className="rg-pf-item-notes">{r.notes}</div>}
                  </div>
                  {confirmDeleteId === r.id ? (
                    <div className="rg-pf-item-actions">
                      <span className="text-muted" style={{ fontSize: 13 }}>
                        Delete?
                      </span>
                      <Button variant="secondary" onClick={() => remove(r.id)}>
                        Delete
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <div className="rg-pf-item-actions">
                      <Button variant="ghost" onClick={() => openEdit(r)}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmDeleteId(r.id)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {editingId != null ? (
            <div className="rg-pf-form">
              <Field label="Race name">
                <Input type="text" maxLength={120} placeholder="e.g. Cocodona 250" value={draft.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <div className="rg-grid-2">
                <Field label="Date">
                  <Input type="date" max={today} value={draft.date} onChange={(e) => set('date', e.target.value)} />
                </Field>
                <Field label="Distance">
                  <Input
                    type="text"
                    maxLength={40}
                    list="rg-pf-distances"
                    placeholder="e.g. 100 miles"
                    value={draft.distance}
                    onChange={(e) => set('distance', e.target.value)}
                  />
                  <datalist id="rg-pf-distances">
                    {DISTANCE_SUGGESTIONS.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <Field label="Finish time" optional>
                <div className="rg-pf-time">
                  <Input type="text" inputMode="numeric" placeholder="hrs" aria-label="Hours" value={draft.hours} onChange={(e) => set('hours', digits(e.target.value))} />
                  <Input type="text" inputMode="numeric" placeholder="min" aria-label="Minutes" value={draft.minutes} onChange={(e) => set('minutes', digits(e.target.value))} />
                  <Input type="text" inputMode="numeric" placeholder="sec" aria-label="Seconds" value={draft.seconds} onChange={(e) => set('seconds', digits(e.target.value))} />
                </div>
              </Field>
              <Field label="Result">
                <div className="seg" style={{ maxWidth: 300 }}>
                  <label className="seg-opt">
                    <input type="radio" name="pf-result" checked={draft.result === 'finished'} onChange={() => set('result', 'finished')} />
                    Finished
                  </label>
                  <label className="seg-opt">
                    <input type="radio" name="pf-result" checked={draft.result === 'dnf'} onChange={() => set('result', 'dnf')} />
                    Did not finish
                  </label>
                </div>
              </Field>
              <Field label="Notes" optional>
                <TextArea rows={2} maxLength={500} placeholder="What went well, what you would change" value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
              </Field>
              {error && <div className="rg-auth-error">{error}</div>}
              <div className="row-3">
                <Button variant="primary" disabled={saving} onClick={save}>
                  {saving ? 'Saving…' : editingId === 'new' ? 'Add race' : 'Save changes'}
                </Button>
                <Button variant="ghost" disabled={saving} onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {error && <div className="rg-auth-error">{error}</div>}
              <div>
                <Button variant="secondary" onClick={openNew}>
                  Add a past race
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Injuries ────────────────────────────────────────────────────────────

interface InjuryDraft {
  area: string;
  status: 'current' | 'past';
  month: string; // yyyy-mm from <input type="month">, '' when not entered
  cause: InjuryCause;
  notes: string;
}

const EMPTY_INJURY: InjuryDraft = { area: '', status: 'current', month: '', cause: '', notes: '' };

function Injuries({ userId, injuries, onChange }: { userId: string; injuries: Injury[] | null; onChange: (i: Injury[]) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InjuryDraft>(EMPTY_INJURY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const thisMonth = localISODate().slice(0, 7);

  const set = <K extends keyof InjuryDraft>(key: K, value: InjuryDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  // Current injuries first, then past; newest first within each group.
  const ordered = (list: Injury[]) =>
    [...list].sort((a, b) => (a.status === b.status ? b.startedOn.localeCompare(a.startedOn) : a.status === 'current' ? -1 : 1));

  function openNew() {
    setDraft(EMPTY_INJURY);
    setError(null);
    setEditingId('new');
  }
  function openEdit(i: Injury) {
    setDraft({ area: i.area, status: i.status, month: i.startedOn.slice(0, 7), cause: i.cause, notes: i.notes });
    setError(null);
    setEditingId(i.id);
  }

  async function save() {
    if (!injuries) return;
    const area = draft.area.trim();
    if (!area) {
      setError('Add the body area, for example Knee or Achilles.');
      return;
    }
    if (draft.month && draft.month > thisMonth) {
      setError('The month it started cannot be in the future.');
      return;
    }
    const input = { area, status: draft.status, startedOn: draft.month ? `${draft.month}-01` : '', cause: draft.cause, notes: draft.notes };
    setSaving(true);
    setError(null);
    try {
      if (editingId === 'new') {
        const created = await insertInjury(userId, input);
        onChange(ordered([created, ...injuries]));
      } else if (editingId) {
        const updated = await updateInjury(editingId, input);
        onChange(ordered(injuries.map((i) => (i.id === updated.id ? updated : i))));
      }
      setEditingId(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!injuries) return;
    setError(null);
    try {
      await deleteInjury(id);
      onChange(injuries.filter((i) => i.id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      setError(errorText(e));
    }
  }

  const list = injuries ? ordered(injuries) : null;

  return (
    <div className="rg-card stack-3">
      <div className="row-3">
        <div className="rg-card-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Injuries</h3>
          <p className="text-muted" style={{ margin: 0, fontSize: 13.5 }}>
            Current and past. Only you can see this: never your crew, never other runners.
          </p>
        </div>
      </div>

      {list == null ? (
        <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
          Loading…
        </p>
      ) : (
        <>
          {list.length === 0 && editingId == null && (
            <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>
              Nothing recorded. Add anything you are managing now, or an old injury that still affects how you train.
            </p>
          )}

          {list.length > 0 && (
            <div className="rg-pf-list">
              {list.map((i) => (
                <div key={i.id} className="rg-pf-item">
                  <div className="rg-pf-item-main">
                    <div className="rg-pf-item-title">
                      {i.area}
                      <span className={`rg-pf-badge ${i.status === 'current' ? 'rg-pf-badge-current' : 'rg-pf-badge-past'}`}>
                        {i.status === 'current' ? 'Current' : 'Past'}
                      </span>
                    </div>
                    {(i.startedOn || i.cause) && (
                      <div className="rg-pf-item-meta">
                        {[i.startedOn ? `Since ${formatMonth(i.startedOn)}` : null, i.cause ? causeLabel(i.cause) : null].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {i.notes && <div className="rg-pf-item-notes">{i.notes}</div>}
                  </div>
                  {confirmDeleteId === i.id ? (
                    <div className="rg-pf-item-actions">
                      <span className="text-muted" style={{ fontSize: 13 }}>
                        Delete?
                      </span>
                      <Button variant="secondary" onClick={() => remove(i.id)}>
                        Delete
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <div className="rg-pf-item-actions">
                      <Button variant="ghost" onClick={() => openEdit(i)}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmDeleteId(i.id)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {editingId != null ? (
            <div className="rg-pf-form">
              <Field label="Body area">
                <Input
                  type="text"
                  maxLength={80}
                  list="rg-pf-areas"
                  placeholder="e.g. Left knee"
                  value={draft.area}
                  onChange={(e) => set('area', e.target.value)}
                />
                <datalist id="rg-pf-areas">
                  {AREA_SUGGESTIONS.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </Field>
              <Field label="Status">
                <div className="seg" style={{ maxWidth: 260 }}>
                  <label className="seg-opt">
                    <input type="radio" name="pf-injury-status" checked={draft.status === 'current'} onChange={() => set('status', 'current')} />
                    Current
                  </label>
                  <label className="seg-opt">
                    <input type="radio" name="pf-injury-status" checked={draft.status === 'past'} onChange={() => set('status', 'past')} />
                    Past
                  </label>
                </div>
              </Field>
              <Field label="Started" optional>
                <Input type="month" max={thisMonth} value={draft.month} onChange={(e) => set('month', e.target.value)} />
              </Field>
              <Field label="How it happened" optional>
                <Select value={draft.cause} onChange={(e) => set('cause', e.target.value as InjuryCause)}>
                  <option value="">—</option>
                  {CAUSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes" optional>
                <TextArea rows={2} maxLength={500} placeholder="What it is, what helps, what to watch" value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
              </Field>
              {error && <div className="rg-auth-error">{error}</div>}
              <div className="row-3">
                <Button variant="primary" disabled={saving} onClick={save}>
                  {saving ? 'Saving…' : editingId === 'new' ? 'Add injury' : 'Save changes'}
                </Button>
                <Button variant="ghost" disabled={saving} onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {error && <div className="rg-auth-error">{error}</div>}
              <div>
                <Button variant="secondary" onClick={openNew}>
                  Add an injury
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
