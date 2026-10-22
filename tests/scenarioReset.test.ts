import { describe, expect, it } from 'vitest';
import { mockBaseline, SCENARIO_MONSOON } from '../src/data/MockDataService';
import { DEFAULT_ASSUMPTIONS } from '../src/simulation/demandPressure';
import { deriveOperationalState } from '../src/simulation/operationalState';
import { createScenarioRunner, INITIAL_MACHINE, reduceScenario, type ScenarioEvent, type ScenarioMachine } from '../src/simulation/ScenarioEngine';

const N = SCENARIO_MONSOON.steps.length;
const derive = (steps: number) => deriveOperationalState(mockBaseline(), SCENARIO_MONSOON, steps, DEFAULT_ASSUMPTIONS);

function harness() {
  let m: ScenarioMachine = INITIAL_MACHINE;
  const queue: (() => void)[] = [];
  const runner = createScenarioRunner({
    getMachine: () => m,
    dispatch: (e: ScenarioEvent) => { m = reduceScenario(m, e, N); },
    totalSteps: () => N,
    stepDurationMs: () => 10,
    schedule: fn => { queue.push(fn); return () => { const i = queue.indexOf(fn); if (i >= 0) queue.splice(i, 1); }; },
  });
  const flush = () => { while (queue.length) queue.shift()!(); };
  return { runner, flush, get m() { return m; }, queue };
}

describe('scenario state machine', () => {
  it('goes IDLE → RUNNING → ACTIVE through every step, then RESET → IDLE', () => {
    const h = harness();
    expect(h.runner.run()).toBe(true);
    expect(h.m.phase).toBe('RUNNING');
    h.flush();
    expect(h.m).toMatchObject({ phase: 'ACTIVE', stepIndex: N, runCount: 1 });
    h.runner.reset();
    expect(h.m).toMatchObject({ phase: 'IDLE', stepIndex: 0 });
  });

  it('ignores duplicate Run clicks while running or active', () => {
    const h = harness();
    h.runner.run();
    expect(h.runner.run()).toBe(false);
    h.flush();
    expect(h.runner.run()).toBe(false);
    expect(h.m.runCount).toBe(1);
  });

  it('reset mid-run cancels pending steps', () => {
    const h = harness();
    h.runner.run();
    h.queue.shift()!(); // one step applied
    expect(h.m.stepIndex).toBe(1);
    h.runner.reset();
    expect(h.queue.length).toBe(0);
    expect(h.m).toMatchObject({ phase: 'IDLE', stepIndex: 0 });
  });

  it('reset is idempotent', () => {
    const a = reduceScenario(INITIAL_MACHINE, { type: 'RESET' }, N);
    expect(a).toBe(INITIAL_MACHINE);
    const h = harness();
    h.runner.run(); h.flush(); h.runner.reset(); const once = { ...h.m }; h.runner.reset();
    expect(h.m).toEqual(once);
  });

  it('a failing step moves the machine to ERROR, and RUN is refused until reset', () => {
    let m: ScenarioMachine = INITIAL_MACHINE; const q: (() => void)[] = [];
    const r = createScenarioRunner({
      getMachine: () => m, dispatch: e => { m = reduceScenario(m, e, N); }, totalSteps: () => N, stepDurationMs: () => 1,
      schedule: fn => { q.push(fn); return () => {}; }, onStep: () => { throw new Error('boom'); },
    });
    r.run(); q.shift()!();
    expect(m).toMatchObject({ phase: 'ERROR', error: 'boom' });
    expect(r.run()).toBe(false);
    r.reset();
    expect(m.phase).toBe('IDLE');
  });
});

describe('deriveOperationalState — determinism and exact reset (SC-03, SC-07, FR-09)', () => {
  it('baseline (0 steps) equals the no-scenario state', () => {
    const none = deriveOperationalState(mockBaseline(), null, 0, DEFAULT_ASSUMPTIONS);
    expect(derive(0)).toEqual(none);
  });

  it('the full scenario gives T2 42 → 86 with scripted inputs tagged SIMULATION', () => {
    const before = derive(0); const after = derive(N);
    expect(before.terminals['terminal-t2'].pressure.index).toBe(42);
    expect(after.terminals['terminal-t2'].pressure.index).toBe(86);
    expect(after.weather.data.precipitationMmPerHour).toBe(50);
    expect(after.weather.state).toBe('SIMULATION');
    expect(after.traffic['road-sahar-inbound'].data).toMatchObject({ currentSpeedKmh: 5, status: 'BLOCKED' });
    expect(after.terminals['terminal-t2'].arrivingPassengers).toBe(1200);
  });

  it('KPIs stay at baseline until the Impact step runs', () => {
    const idx = SCENARIO_MONSOON.steps.findIndex(s => s.id === 'impact');
    expect(derive(idx).terminals['terminal-t2'].pressure.index).toBe(42);
    expect(derive(idx + 1).terminals['terminal-t2'].pressure.index).toBe(86);
  });

  it('repeat runs produce identical outputs, and the baseline input is never mutated', () => {
    const base = mockBaseline(); const frozen = structuredClone(base);
    const r1 = deriveOperationalState(base, SCENARIO_MONSOON, N, DEFAULT_ASSUMPTIONS);
    const r2 = deriveOperationalState(base, SCENARIO_MONSOON, N, DEFAULT_ASSUMPTIONS);
    expect(r1).toEqual(r2);
    expect(base).toEqual(frozen);
    expect(deriveOperationalState(base, SCENARIO_MONSOON, 0, DEFAULT_ASSUMPTIONS)).toEqual(derive(0));
  });
});
