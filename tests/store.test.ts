import { afterEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../src/state/store';

afterEach(() => vi.useRealTimers());

describe('store role/scenario interplay', () => {
  it('Admin can switch data mode while a scenario is active: it resets to baseline and archives the alert', () => {
    vi.useFakeTimers();
    const s = useApp.getState();
    s.setRole('ANALYST');
    s.runScenario();
    vi.runAllTimers();
    expect(useApp.getState().machine.phase).toBe('ACTIVE');
    expect(useApp.getState().alerts.some(a => !a.archived)).toBe(true);

    useApp.getState().setRole('ADMIN');
    useApp.getState().setDataMode('LIVE');
    const after = useApp.getState();
    expect(after.dataMode).toBe('LIVE');
    expect(after.machine).toMatchObject({ phase: 'IDLE', stepIndex: 0 });
    expect(after.alerts.every(a => a.archived)).toBe(true);
    expect(after.events.find(e => e.kind === 'SCENARIO_RESET')?.detail).toMatch(/data mode/);
  });

  it('attributes a role change to the role that made it', () => {
    useApp.getState().setRole('SUPERVISOR');
    useApp.getState().setRole('VIEWER');
    const e = useApp.getState().events.find(x => x.kind === 'ROLE_CHANGED')!;
    expect(e.actorRole).toBe('Operations Supervisor');
    expect(e.detail).toBe('Role changed to Viewer / Executive');
  });

  it('a Viewer cannot run or reset the scenario', () => {
    useApp.getState().setRole('VIEWER');
    useApp.getState().runScenario();
    expect(useApp.getState().machine.phase).toBe('IDLE');
  });
});
