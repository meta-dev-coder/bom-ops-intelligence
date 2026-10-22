/**
 * Supervisor-editable model parameters and thresholds (spec §10: "change approved scenario
 * parameters and thresholds"). Drafts are raw strings while typing and validated only on Apply,
 * so a field can be cleared and retyped; nothing is silently clamped.
 */
import type { DemandPressureAssumptions } from './demandPressure';

export type ParamKey = 'pickupShare' | 'passengersPerVehicle' | 'baselineVehiclesPerHour' | 'roadCapacityFloor';
export type BandKey = 'band:Moderate' | 'band:High' | 'band:Severe';
export type EditableKey = ParamKey | BandKey;

export const EDITABLE_FIELDS: { key: ParamKey; label: string; step: number; min: number; max: number }[] = [
  { key: 'pickupShare', label: 'Pickup share (0–1)', step: 0.05, min: 0, max: 1 },
  { key: 'passengersPerVehicle', label: 'Passengers / vehicle', step: 0.1, min: 0.5, max: 6 },
  { key: 'baselineVehiclesPerHour', label: 'Forecourt capacity (veh/h)', step: 50, min: 100, max: 5000 },
  { key: 'roadCapacityFloor', label: 'Road capacity floor (0–1)', step: 0.05, min: 0, max: 1 },
];

/** Band lower bounds the supervisor can move; "Low" always starts at 0. */
export const BAND_FIELDS: { key: BandKey; label: string; band: string }[] = [
  { key: 'band:Moderate', label: 'Moderate from', band: 'Moderate' },
  { key: 'band:High', label: 'High from', band: 'High' },
  { key: 'band:Severe', label: 'Severe from', band: 'Severe' },
];

export type Draft = Record<EditableKey, string>;

export const toDraft = (a: DemandPressureAssumptions): Draft => {
  const d = Object.fromEntries(EDITABLE_FIELDS.map(f => [f.key, String(a[f.key])])) as Draft;
  for (const b of BAND_FIELDS) d[b.key] = String(a.bands.find(x => x.label === b.band)?.minIndex ?? '');
  return d;
};

/** Returns the new assumptions, or per-field errors. */
export function applyDraft(base: DemandPressureAssumptions, draft: Draft):
  { ok: true; value: DemandPressureAssumptions } | { ok: false; errors: Partial<Record<EditableKey, string>> } {
  const errors: Partial<Record<EditableKey, string>> = {};
  const value: DemandPressureAssumptions = { ...base };
  for (const f of EDITABLE_FIELDS) {
    const raw = draft[f.key].trim();
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) errors[f.key] = 'Enter a number';
    else if (n < f.min || n > f.max) errors[f.key] = `Must be between ${f.min} and ${f.max}`;
    else value[f.key] = n;
  }
  const mins: number[] = [];
  for (const b of BAND_FIELDS) {
    const raw = draft[b.key].trim();
    const n = Number(raw);
    if (raw === '' || !Number.isInteger(n) || n < 1 || n > 100) errors[b.key] = 'Whole number 1–100';
    else if (mins.length && n <= mins[mins.length - 1]) errors[b.key] = 'Must be above the previous band';
    mins.push(n);
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  value.bands = [{ label: 'Low', minIndex: 0 }, ...BAND_FIELDS.map((b, i) => ({ label: b.band, minIndex: mins[i] }))];
  return { ok: true, value };
}
