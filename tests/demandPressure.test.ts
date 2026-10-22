import { describe, expect, it } from 'vitest';
import { computeDemandPressure, DEFAULT_ASSUMPTIONS, bandFor, weatherCapacityFactor } from '../src/simulation/demandPressure';

const t2Baseline = { arrivingPassengers: 1200, departingDropoffVehicles: 160, roadCurrentSpeedKmh: 32, roadFreeFlowSpeedKmh: 45, rainfallMmPerHour: 0 };
const t2Scenario = { ...t2Baseline, roadCurrentSpeedKmh: 5, rainfallMmPerHour: 50 };

describe('computeDemandPressure', () => {
  it('reproduces the spec baseline: T2 index 42, Moderate (Appendix B.1)', () => {
    const r = computeDemandPressure(t2Baseline);
    expect(r.index).toBe(42);
    expect(r.band).toBe('Moderate');
    expect(r.projectedVehicleDemand).toBe(400);
  });

  it('reproduces the spec scenario: T2 index 86, Severe (Appendix B.2)', () => {
    const r = computeDemandPressure(t2Scenario);
    expect(r.index).toBe(86);
    expect(r.band).toBe('Severe');
    expect(r.weatherCapacityFactor).toBe(0.75);
    expect(r.dispatchDelayMinutes).toBeGreaterThan(computeDemandPressure(t2Baseline).dispatchDelayMinutes!);
  });

  it('is deterministic for identical inputs', () => {
    expect(computeDemandPressure(t2Scenario)).toEqual(computeDemandPressure({ ...t2Scenario }));
  });

  it('covers normal, elevated and severe bands as conditions worsen', () => {
    const normal = computeDemandPressure({ ...t2Baseline, arrivingPassengers: 300, departingDropoffVehicles: 60, roadCurrentSpeedKmh: 45 });
    const elevated = computeDemandPressure({ ...t2Baseline, roadCurrentSpeedKmh: 15, rainfallMmPerHour: 12 });
    const severe = computeDemandPressure(t2Scenario);
    expect(normal.band).toBe('Low');
    expect(elevated.band).toBe('High');
    expect(severe.band).toBe('Severe');
    expect(normal.index).toBeLessThan(elevated.index);
    expect(elevated.index).toBeLessThan(severe.index);
  });

  it('handles zero capacity without NaN: index 100, Severe, no fabricated delay', () => {
    const r = computeDemandPressure(t2Baseline, { ...DEFAULT_ASSUMPTIONS, baselineVehiclesPerHour: 0 });
    expect(r.index).toBe(100);
    expect(r.band).toBe('Severe');
    expect(r.dispatchDelayMinutes).toBeNull();
  });

  it('handles zero demand and zero capacity as no pressure', () => {
    const r = computeDemandPressure({ ...t2Baseline, arrivingPassengers: 0, departingDropoffVehicles: 0 }, { ...DEFAULT_ASSUMPTIONS, baselineVehiclesPerHour: 0 });
    expect(r.index).toBe(0);
    expect(Number.isNaN(r.pressureRatio)).toBe(false);
  });

  it('uses road factor 1 when the terminal has no configured road', () => {
    const r = computeDemandPressure({ arrivingPassengers: 600, departingDropoffVehicles: 80, rainfallMmPerHour: 0 });
    expect(r.speedRatio).toBeNull();
    expect(r.roadCapacityFactor).toBe(1);
  });

  it('computes speed ratio as current ÷ free-flow (spec §6 travel-time note), clamped to 1', () => {
    expect(computeDemandPressure({ ...t2Baseline, roadCurrentSpeedKmh: 60 }).speedRatio).toBe(1);
    expect(computeDemandPressure(t2Baseline).speedRatio).toBeCloseTo(32 / 45);
  });

  it('band and rainfall lookups pick the highest matching threshold', () => {
    expect(bandFor(79, DEFAULT_ASSUMPTIONS.bands)).toBe('High');
    expect(bandFor(80, DEFAULT_ASSUMPTIONS.bands)).toBe('Severe');
    expect(weatherCapacityFactor(9.9, DEFAULT_ASSUMPTIONS.rainCapacityFactors)).toBe(0.95);
  });
});
