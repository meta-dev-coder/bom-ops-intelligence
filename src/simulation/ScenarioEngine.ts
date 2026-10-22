/**
 * Scenario state machine (spec §8.2): IDLE → RUNNING → ACTIVE → RESETTING → IDLE, plus ERROR.
 * `reduceScenario` is pure; `createScenarioRunner` drives it with an injected scheduler so tests
 * (and reduced-motion mode) can step it without real timers. Animation time never feeds KPIs —
 * only `stepIndex` does.
 */
import type { ScenarioPhase } from '../types/scenarios';

export interface ScenarioMachine {
  phase: ScenarioPhase;
  /** Number of scenario steps applied (0 = baseline). */
  stepIndex: number;
  runCount: number;
  error?: string;
}

export type ScenarioEvent =
  | { type: 'RUN' }
  | { type: 'STEP' }
  | { type: 'RESET' }
  | { type: 'RESET_DONE' }
  | { type: 'FAIL'; error: string };

export const INITIAL_MACHINE: ScenarioMachine = { phase: 'IDLE', stepIndex: 0, runCount: 0 };

export function reduceScenario(m: ScenarioMachine, e: ScenarioEvent, totalSteps: number): ScenarioMachine {
  switch (e.type) {
    case 'RUN':
      // Duplicate clicks while running/active are ignored; ERROR needs a reset first.
      return m.phase === 'IDLE' ? { phase: 'RUNNING', stepIndex: 0, runCount: m.runCount + 1 } : m;
    case 'STEP': {
      if (m.phase !== 'RUNNING') return m;
      const stepIndex = Math.min(totalSteps, m.stepIndex + 1);
      return { ...m, stepIndex, phase: stepIndex >= totalSteps ? 'ACTIVE' : 'RUNNING' };
    }
    case 'RESET':
      return m.phase === 'IDLE' && m.stepIndex === 0 ? m : { ...m, phase: 'RESETTING', error: undefined };
    case 'RESET_DONE':
      return m.phase === 'RESETTING' ? { phase: 'IDLE', stepIndex: 0, runCount: m.runCount } : m;
    case 'FAIL':
      return m.phase === 'RUNNING' ? { ...m, phase: 'ERROR', error: e.error } : m;
    default:
      return m;
  }
}

export type Schedule = (fn: () => void, ms: number) => () => void;
export const realSchedule: Schedule = (fn, ms) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export interface ScenarioRunnerDeps {
  getMachine: () => ScenarioMachine;
  dispatch: (e: ScenarioEvent) => void;
  totalSteps: () => number;
  stepDurationMs: () => number;
  schedule?: Schedule;
  /** Called after every applied step; a throw moves the machine to ERROR. */
  onStep?: (stepIndex: number) => void;
}

export function createScenarioRunner(deps: ScenarioRunnerDeps) {
  const schedule = deps.schedule ?? realSchedule;
  let cancel: (() => void) | null = null;

  const tick = () => {
    cancel = null;
    if (deps.getMachine().phase !== 'RUNNING') return;
    deps.dispatch({ type: 'STEP' });
    try {
      deps.onStep?.(deps.getMachine().stepIndex);
    } catch (err) {
      deps.dispatch({ type: 'FAIL', error: err instanceof Error ? err.message : String(err) });
      return;
    }
    if (deps.getMachine().phase === 'RUNNING') cancel = schedule(tick, deps.stepDurationMs());
  };

  return {
    run() {
      if (deps.getMachine().phase !== 'IDLE') return false;
      deps.dispatch({ type: 'RUN' });
      cancel = schedule(tick, deps.stepDurationMs());
      return true;
    },
    reset() {
      cancel?.();
      cancel = null;
      deps.dispatch({ type: 'RESET' });
      deps.dispatch({ type: 'RESET_DONE' });
    },
    dispose() {
      cancel?.();
      cancel = null;
    },
  };
}
