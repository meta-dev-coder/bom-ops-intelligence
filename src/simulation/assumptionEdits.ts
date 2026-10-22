/**
 * Supervisor-editable model parameters (spec §10). Drafts are kept as raw strings while typing
 * and validated only on Apply, so a field can be cleared and retyped.
 */
import type { DemandPressureAssumptions } from './demandPressure';

export type EditableKey = 'pickupShare' | 'passengersPerVehicle' | 'baselineVehiclesPerHour' | 'roadCapacityFloor';

export const EDITABLE_FIELDS: { key: EditableKey; label: string; step: number; min: number; max: number }[] = [
  { key: 'pickupShare', label: 'Pickup share (0–1)', step: 0.05, min: 0, max: 1 },
  { key: 'passengersPerVehicle', label: 'Passengers / vehicle', step: 0.1, min: 0.5, max: 6 },
  { key: 'baselineVehiclesPerHour', label: 'Forecourt capacity (veh/h)', step: 50, min: 100, max: 5000 },
  { key: 'roadCapacityFloor', label: 'Road capacity floor (0–1)', step: 0.05, min: 0, max: 1 },
];

export type Draft = Record<EditableKey, string>;

export const toDraft = (a: DemandPressureAssumptions): Draft =>
  Object.fromEntries(EDITABLE_FIELDS.map(f => [f.key, String(a[f.key])])) as Draft;

/** Returns the new assumptions, or per-field errors; never silently clamps. */
export function applyDraft(base: DemandPressureAssumptions, draft: Draft):
  { ok: true; value: DemandPressureAssumptions } | { ok: false; errors: Partial<Record<EditableKey, string>> } {
  const errors: Partial<Record<EditableKey, string>> = {};
  const value = { ...base };
  for (const f of EDITABLE_FIELDS) {
    const raw = draft[f.key].trim();
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) errors[f.key] = 'Enter a number';
    else if (n < f.min || n > f.max) errors[f.key] = `Must be between ${f.min} and ${f.max}`;
    else value[f.key] = n;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
