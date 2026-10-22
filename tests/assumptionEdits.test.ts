import { describe, expect, it } from 'vitest';
import { applyDraft, toDraft } from '../src/simulation/assumptionEdits';
import { DEFAULT_ASSUMPTIONS } from '../src/simulation/demandPressure';

describe('assumption editor validation', () => {
  it('round-trips the defaults unchanged', () => {
    expect(applyDraft(DEFAULT_ASSUMPTIONS, toDraft(DEFAULT_ASSUMPTIONS))).toEqual({ ok: true, value: DEFAULT_ASSUMPTIONS });
  });
  it('rejects an empty field instead of turning it into 0', () => {
    const r = applyDraft(DEFAULT_ASSUMPTIONS, { ...toDraft(DEFAULT_ASSUMPTIONS), passengersPerVehicle: '' });
    expect(r.ok).toBe(false);
  });
  it('rejects out-of-range values (e.g. zero forecourt capacity) rather than clamping', () => {
    const r = applyDraft(DEFAULT_ASSUMPTIONS, { ...toDraft(DEFAULT_ASSUMPTIONS), baselineVehiclesPerHour: '0' });
    expect(r).toMatchObject({ ok: false, errors: { baselineVehiclesPerHour: expect.stringContaining('between') } });
  });
  it('accepts a valid edit', () => {
    const r = applyDraft(DEFAULT_ASSUMPTIONS, { ...toDraft(DEFAULT_ASSUMPTIONS), passengersPerVehicle: '3' });
    expect(r.ok && r.value.passengersPerVehicle).toBe(3);
  });
});
