import { useState } from 'react';
import { Button } from './ui/Button';
import { Input, Select, TextArea } from './ui/Form';
import { saveRaceResult } from '../lib/api';
import { DNF_REASONS, parseMilesCompleted, resultDetailParts } from '../lib/raceResult';
import type { DnfReason, RaceResult } from '../types';

const RESULT_LABEL: Record<RaceResult, string> = {
  finished: 'Finished',
  dnf: 'Did not finish (DNF)',
  dns: 'Did not start (DNS)',
  cancelled: 'Race cancelled',
};

const digits = (v: string) => v.replace(/[^\d]/g, '');
const decimal = (v: string) => v.replace(/[^\d.]/g, '');

export interface RaceResultPatch {
  raceResult: RaceResult | null;
  raceFinishSeconds: number | null;
  raceMilesCompleted: number | null;
  raceDnfReason: DnfReason | '';
  raceResultNote: string;
}

/** "How did it go?" for a race whose date has passed (My Races). Records finished (with the
 * finish time), DNF (miles, time on feet, reason, note), DNS, or cancelled (miles, time on
 * feet, note) on the plan itself. Owner-only in the database; stays editable after the race
 * locks, since people often fill it in later. */
export function RaceResultBox({
  planId,
  result,
  finishSeconds,
  milesCompleted,
  dnfReason,
  note,
  onSaved,
}: {
  planId: string;
  result: RaceResult | null | undefined;
  finishSeconds: number | null | undefined;
  milesCompleted: number | null | undefined;
  dnfReason: DnfReason | '' | undefined;
  note: string | undefined;
  onSaved: (patch: RaceResultPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<RaceResult | ''>(result ?? '');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [miles, setMiles] = useState('');
  const [reason, setReason] = useState<DnfReason | ''>('');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    const t = finishSeconds ?? 0;
    setChoice(result ?? '');
    setHours(finishSeconds ? String(Math.floor(t / 3600)) : '');
    setMinutes(finishSeconds ? String(Math.floor((t % 3600) / 60)) : '');
    setSeconds(finishSeconds ? String(t % 60) : '');
    setMiles(milesCompleted != null ? String(milesCompleted) : '');
    setReason(dnfReason ?? '');
    setNoteText(note ?? '');
    setError(null);
    setOpen(true);
  }

  async function save(next: RaceResult | null) {
    const total = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
    const ran = next === 'dnf' || next === 'cancelled';
    const parsedMiles = parseMilesCompleted(miles);
    if (next === 'finished' && total <= 0) {
      setError('Add your finish time.');
      return;
    }
    if (ran && parsedMiles === undefined) {
      setError('Miles should be a number, for example 140 or 52.3.');
      return;
    }
    const patch: RaceResultPatch = {
      raceResult: next,
      raceFinishSeconds: (next === 'finished' || ran) && total > 0 ? total : null,
      raceMilesCompleted: ran ? (parsedMiles ?? null) : null,
      raceDnfReason: next === 'dnf' ? reason : '',
      raceResultNote: ran ? noteText.trim() : '',
    };
    setSaving(true);
    setError(null);
    try {
      await saveRaceResult(planId, {
        result: patch.raceResult,
        finishSeconds: patch.raceFinishSeconds,
        milesCompleted: patch.raceMilesCompleted,
        dnfReason: patch.raceDnfReason,
        note: patch.raceResultNote,
      });
      onSaved(patch);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the result. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    const details = resultDetailParts({ result, finishSeconds, milesCompleted, dnfReason });
    return (
      <div className="rg-races-result">
        {result ? (
          <>
            <span className="rg-races-result-label">Result</span>
            <span className={`rg-races-result-value rg-races-result-${result}`}>
              {[RESULT_LABEL[result], ...details].join(' · ')}
            </span>
            <Button variant="ghost" onClick={openForm}>
              Edit result
            </Button>
            {note && <div className="rg-races-result-note">{note}</div>}
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

  const timeInputs = (
    <div className="rg-races-result-time">
      <Input type="text" inputMode="numeric" placeholder="hrs" aria-label="Hours" value={hours} onChange={(e) => setHours(digits(e.target.value))} />
      <Input type="text" inputMode="numeric" placeholder="min" aria-label="Minutes" value={minutes} onChange={(e) => setMinutes(digits(e.target.value))} />
      <Input type="text" inputMode="numeric" placeholder="sec" aria-label="Seconds" value={seconds} onChange={(e) => setSeconds(digits(e.target.value))} />
    </div>
  );

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
          <span>Finish time</span>
          {timeInputs}
        </div>
      )}
      {(choice === 'dnf' || choice === 'cancelled') && (
        <>
          <label className="rg-races-result-field">
            <span>{choice === 'dnf' ? 'Miles before you stopped (optional)' : 'Miles run before it was called off (optional)'}</span>
            <Input type="text" inputMode="decimal" placeholder="e.g. 140" value={miles} onChange={(e) => setMiles(decimal(e.target.value))} />
          </label>
          <div className="rg-races-result-field">
            <span>Time on feet (optional)</span>
            {timeInputs}
          </div>
        </>
      )}
      {choice === 'dnf' && (
        <label className="rg-races-result-field">
          <span>Reason (optional)</span>
          <Select value={reason} onChange={(e) => setReason(e.target.value as DnfReason | '')}>
            <option value="">—</option>
            {DNF_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </label>
      )}
      {(choice === 'dnf' || choice === 'cancelled') && (
        <label className="rg-races-result-field">
          <span>{choice === 'dnf' ? 'Note (optional)' : 'What happened (optional)'}</span>
          <TextArea rows={2} maxLength={200} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
        </label>
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
