import { formatFinishTime } from './format';
import type { DnfReason, RaceResult } from '../types';

/** Why a race ended in a DNF (a dropdown on the result forms). */
export const DNF_REASONS: { value: DnfReason; label: string }[] = [
  { value: 'injury', label: 'Injury' },
  { value: 'illness', label: 'Illness' },
  { value: 'cutoff', label: 'Missed a cutoff' },
  { value: 'stomach', label: 'Stomach or nutrition' },
  { value: 'heat_weather', label: 'Heat or weather' },
  { value: 'fatigue', label: 'Fatigue or low motivation' },
  { value: 'other', label: 'Other' },
];

const DNF_REASON_VALUES = DNF_REASONS.map((r) => r.value as string);

/** Narrows a database value to a known reason, or '' (not entered). */
export function toDnfReason(v: unknown): DnfReason | '' {
  return typeof v === 'string' && DNF_REASON_VALUES.includes(v) ? (v as DnfReason) : '';
}

export function dnfReasonLabel(reason: DnfReason | '' | null | undefined): string {
  return DNF_REASONS.find((r) => r.value === reason)?.label ?? '';
}

/** Miles as a short string: whole numbers plain, otherwise one decimal (140, 52.3). */
export function formatMilesShort(miles: number): string {
  return Number.isInteger(miles) ? String(miles) : String(Math.round(miles * 10) / 10);
}

/** The details shown after a result, in reading order: "140 mi", "38:20:00", "Injury".
 * A finished race has just its time; DNF and cancelled add the miles run before it ended
 * (the time is then the time on feet), and DNF adds the reason. */
export function resultDetailParts(d: {
  result: RaceResult | null | undefined;
  finishSeconds: number | null | undefined;
  milesCompleted: number | null | undefined;
  dnfReason: DnfReason | '' | null | undefined;
}): string[] {
  const parts: string[] = [];
  if ((d.result === 'dnf' || d.result === 'cancelled') && d.milesCompleted != null) {
    parts.push(`${formatMilesShort(d.milesCompleted)} mi`);
  }
  if (d.finishSeconds && d.result !== 'dns') parts.push(formatFinishTime(d.finishSeconds));
  if (d.result === 'dnf' && d.dnfReason) parts.push(dnfReasonLabel(d.dnfReason));
  return parts;
}

/** Parses a miles text box: '' -> null; otherwise a non-negative number up to 1000, or undefined if invalid. */
export function parseMilesCompleted(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1000) return undefined;
  return n;
}
