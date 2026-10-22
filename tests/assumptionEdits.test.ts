import { describe, expect, it } from 'vitest';
import { applyDraft, toDraft } from '../src/simulation/assumptionEdits';
import { bandFor, DEFAULT_ASSUMPTIONS } from '../src/simulation/demandPressure';

const draft = () => toDraft(DEFAULT_ASSUMPTIONS);

describe('assumption & threshold editor validation', () => {
  it('round-trips the defaults unchanged', () => {
    expect(applyDraft(DEFAULT_ASSUMPTIONS, draft())).toEqual({ ok: true, value: DEFAULT_ASSUMPTIONS });
  });
  it('rejects an empty field instead of turning it into 0', () => {
    expect(applyDraft(DEFAULT_ASSUMPTIONS, { ...draft(), passengersPerVehicle: '' }).ok).toBe(false);
  });
  it('rejects out-of-range values (e.g. zero forecourt capacity) rather than clamping', () => {
    const r = applyDraft(DEFAULT_ASSUMPTIONS, { ...draft(), baselineVehiclesPerHour: '0' });
    expect(r).toMatchObject({ ok: false, errors: { baselineVehiclesPerHour: expect.stringContaining('between') } });
  });
  it('accepts a valid parameter edit', () => {
    const r = applyDraft(DEFAULT_ASSUMPTIONS, { ...draft(), passengersPerVehicle: '3' });
    expect(r.ok && r.value.passengersPerVehicle).toBe(3);
  });
  it('lets a supervisor move band thresholds, which changes the computed band', () => {
    const r = applyDraft(DEFAULT_ASSUMPTIONS, { ...draft(), 'band:Severe': '90' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(bandFor(86, r.value.bands)).toBe('High');
  });
  it('requires band thresholds in ascending order', () => {
    const r = applyDraft(DEFAULT_ASSUMPTIONS, { ...draft(), 'band:High': '25' });
    expect(r).toMatchObject({ ok: false, errors: { 'band:High': expect.stringContaining('above') } });
  });
});
