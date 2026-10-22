import { describe, expect, it } from 'vitest';
import { mockBaseline, SCENARIO_MONSOON } from '../src/data/MockDataService';
import { buildScenarioAlert } from '../src/simulation/alertRules';
import { DEFAULT_ASSUMPTIONS } from '../src/simulation/demandPressure';
import { deriveOperationalState } from '../src/simulation/operationalState';
import { ENTITY_NAMES } from '../src/map/EntityRegistry';

const N = SCENARIO_MONSOON.steps.length;
const build = (steps = N) => buildScenarioAlert({
  scenario: SCENARIO_MONSOON, runCount: 1,
  baseline: deriveOperationalState(mockBaseline(), SCENARIO_MONSOON, 0, DEFAULT_ASSUMPTIONS),
  result: deriveOperationalState(mockBaseline(), SCENARIO_MONSOON, steps, DEFAULT_ASSUMPTIONS),
  assumptions: DEFAULT_ASSUMPTIONS, createdAt: '2026-10-21T18:32:00+05:30', entityNames: ENTITY_NAMES,
});

describe('buildScenarioAlert (SC-06)', () => {
  it('explains observation, impact, factors, recommendations, assumptions and data state', () => {
    const a = build()!;
    expect(a.title).toBe('Terminal 2 forecourt demand pressure elevated');
    expect(a.observation).toContain('50 mm/h');
    expect(a.observation).toContain('5 km/h');
    expect(a.observation).toContain('1,200');
    expect(a.impact).toContain('from 42 (Moderate) to 86 (Severe)');
    expect(a.contributingFactors).toHaveLength(4);
    expect(a.recommendations.length).toBeGreaterThan(0);
    expect(a.assumptions.some(s => s.includes('No actual road closure'))).toBe(true);
    expect(a.sourceStates.every(s => s.state === 'SIMULATION')).toBe(true);
    expect(a).toMatchObject({ origin: 'SCENARIO', status: 'NEW', severity: 'HIGH', alertId: 'scenario-a-monsoon-sahar-run-1' });
  });

  it('never asserts real-world actions or measured outcomes (spec §6.1, §8.3)', () => {
    const text = JSON.stringify(build());
    for (const banned of [/MLCP level/i, /CISF/i, /\b45[- ]minute/i, /queue time (will be|of \d)/i, /capacity breach (will|is (expected|likely|predicted))/i, /send .*notification/i]) {
      expect(text).not.toMatch(banned);
    }
  });

  it('raises nothing when the target stays below the alert band', () => {
    expect(build(0)).toBeNull();
  });
});
