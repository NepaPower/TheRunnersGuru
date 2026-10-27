import { useState } from 'react';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Form';
import { saveRaceResult } from '../lib/api';
import { formatFinishTime } from '../lib/format';
import type { RaceResult } from '../types';

const RESULT_LABEL: Record<RaceResult, string> = {
  finished: 'Finished',
  dnf: 'Did not finish (DNF)',
  dns: 'Did not start (DNS)',
  cancelled: 'Race cancelled',
};

const digits = (v: string) => v.replace(/[^\d]/g, '');

/** "How did it go?" for a race whose date has passed (My Races). Records finished (with an
 * optional time), DNF, DNS or cancelled on the plan itself. Owner-only in the database; stays
 * editable after the race locks, since people often fill it in later. */
export function RaceResultBox({
  planId,
  result,
  finishSeconds,
  onSaved,
}: {
  planId: string;
  result: RaceResult | null | undefined;
  finishSeconds: number | null | undefined;
  onSaved: (patch: { raceResult: RaceResult | null; raceFinishSeconds: number | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<RaceResult | ''>(result ?? '');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    const t = finishSeconds ?? 0;
    setChoice(result ?? '');
    setHours(finishSeconds ? String(Math.floor(t / 3600)) : '');
    setMinutes(finishSeconds ? String(Math.floor((t % 3600) / 60)) : '');
    setSeconds(finishSeconds ? String(t % 60) : '');
    setError(null);
    setOpen(true);
  }

  async function save(next: RaceResult | null) {
    const total = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
    const finish = next === 'finished' && total > 0 ? total : null;
    setSaving(true);
    setError(null);
    try {
      await saveRaceResult(planId, next, finish);
      onSaved({ raceResult: next, raceFinishSeconds: finish });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the result. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="rg-races-result">
        {result ? (
          <>
            <span className="rg-races-result-label">Result</span>
            <span className={`rg-races-result-value rg-races-result-${result}`}>
              {RESULT_LABEL[result]}
              {result === 'finished' && finishSeconds ? ` · ${formatFinishTime(finishSeconds)}` : ''}
            </span>
            <Button variant="ghost" onClick={openForm}>
              Edit result
            </Button>
          </>
        ) : (
          <>
            <span className="rg-races-result-label">How did it go?</span>
            <Button variant="secondary" onClick={openForm}>
              Add result
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rg-races-result rg-races-result-form">
      <label className="rg-races-result-field">
        <span>Outcome</span>
        <Select value={choice} onChange={(e) => setChoice(e.target.value as RaceResult | '')}>
          <option value="">Choose…</option>
          {(Object.keys(RESULT_LABEL) as RaceResult[]).map((r) => (
            <option key={r} value={r}>
              {RESULT_LABEL[r]}
            </option>
          ))}
        </Select>
      </label>
      {choice === 'finished' && (
        <div className="rg-races-result-field">
          <span>Finish time (optional)</span>
          <div className="rg-races-result-time">
            <Input type="text" inputMode="numeric" placeholder="hrs" aria-label="Hours" value={hours} onChange={(e) => setHours(digits(e.target.value))} />
            <Input type="text" inputMode="numeric" placeholder="min" aria-label="Minutes" value={minutes} onChange={(e) => setMinutes(digits(e.target.value))} />
            <Input type="text" inputMode="numeric" placeholder="sec" aria-label="Seconds" value={seconds} onChange={(e) => setSeconds(digits(e.target.value))} />
          </div>
        </div>
      )}
      {error && <div className="rg-auth-error">{error}</div>}
      <div className="rg-races-result-actions">
        <Button variant="primary" disabled={saving || !choice} onClick={() => choice && save(choice)}>
          {saving ? 'Saving…' : 'Save result'}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {result && (
          <Button variant="ghost" disabled={saving} onClick={() => save(null)}>
            Clear result
          </Button>
        )}
      </div>
    </div>
  );
}
