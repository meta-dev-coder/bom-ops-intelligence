import { describe, expect, it } from 'vitest';
import { mockBaseline, SCENARIO_MONSOON, BASELINE_FIXTURE } from '../src/data/MockDataService';
import { DEFAULT_ASSUMPTIONS } from '../src/simulation/demandPressure';
import { deriveOperationalState } from '../src/simulation/operationalState';
import { buildScenarioResult } from '../src/simulation/scenarioResult';

const N = SCENARIO_MONSOON.steps.length;
const build = (createdAt: string) => buildScenarioResult({
  scenario: SCENARIO_MONSOON, runCount: 1, assumptions: DEFAULT_ASSUMPTIONS, baselineFixtureId: BASELINE_FIXTURE.fixtureId, createdAt,
  baseline: deriveOperationalState(mockBaseline(), SCENARIO_MONSOON, 0, DEFAULT_ASSUMPTIONS),
  result: deriveOperationalState(mockBaseline(), SCENARIO_MONSOON, N, DEFAULT_ASSUMPTIONS),
});

describe('scenario result record (spec §8.2)', () => {
  it('records scenario id, version, inputs, assumptions, outputs and timestamp', () => {
    const r = build('2026-10-22T10:00:00Z');
    expect(r).toMatchObject({ scenarioId: 'scenario-a-monsoon-sahar', version: '1.0.0', runId: 'scenario-a-monsoon-sahar-run-1', createdAt: '2026-10-22T10:00:00Z' });
    expect(r.inputs.weather).toMatchObject({ precipitationMmPerHour: 50, state: 'SIMULATION' });
    expect(r.inputs.roads.find(x => x.id === 'road-sahar-inbound')).toMatchObject({ currentSpeedKmh: 5, status: 'BLOCKED' });
    expect(r.inputs.arrivals.find(a => a.terminalId === 'terminal-t2')).toMatchObject({ flights: 4, passengers: 1200 });
    expect(r.assumptions).toMatchObject({ pickupShare: 0.4, baselineVehiclesPerHour: 1400 });
    expect(r.outputs.find(o => o.terminalId === 'terminal-t2')).toMatchObject({ baselineIndex: 42, index: 86, band: 'Severe' });
  });
  it('is identical across runs apart from the timestamp (SC-03)', () => {
    const { createdAt: _a, ...a } = build('2026-10-22T10:00:00Z');
    const { createdAt: _b, ...b } = build('2026-10-22T11:00:00Z');
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a); // serialisable for export
  });
});
