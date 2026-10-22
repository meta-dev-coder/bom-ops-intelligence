import { describe, expect, it } from 'vitest';
import { DEMO_STEPS, isStepDone, shouldShowStartTile, DEMO_SEEN_KEY, type DemoSnapshot } from '../src/demo/demoFlow';

const base: DemoSnapshot = { selectedEntityId: null, phase: 'IDLE', stepIndex: 0, alertExpanded: false, hasActiveAlert: false, hasArchivedAlert: false };
const step = (id: string) => DEMO_STEPS.find(s => s.id === id)!;

describe('guided demo flow', () => {
  it('follows the spec presenter script order (Appendix B.3)', () => {
    expect(DEMO_STEPS.map(s => s.id)).toEqual(['mode', 't2', 'road', 'run', 'alert', 'reset']);
  });
  it('every actionable step has an instruction and a do-it-for-me label', () => {
    for (const s of DEMO_STEPS.filter(x => x.action)) {
      expect(s.instruction).toBeTruthy();
      expect(s.actionLabel).toBeTruthy();
    }
  });
  it('detects each step being completed by the user', () => {
    expect(isStepDone(step('mode'), base)).toBe(false);
    expect(isStepDone(step('t2'), { ...base, selectedEntityId: 'terminal-t2' })).toBe(true);
    expect(isStepDone(step('road'), { ...base, selectedEntityId: 'road-sahar-inbound' })).toBe(true);
    expect(isStepDone(step('run'), { ...base, phase: 'RUNNING' })).toBe(false);
    expect(isStepDone(step('run'), { ...base, phase: 'ACTIVE', stepIndex: 5 })).toBe(true);
    expect(isStepDone(step('alert'), { ...base, hasActiveAlert: true, alertExpanded: true })).toBe(true);
    expect(isStepDone(step('reset'), { ...base, hasArchivedAlert: true })).toBe(true);
    expect(isStepDone(step('reset'), base)).toBe(false);
  });
  it('start tile shows on first visit, not after it was dismissed, and never with ?intro=off', () => {
    const mem = (v: string | null) => ({ getItem: (k: string) => (k === DEMO_SEEN_KEY ? v : null) });
    expect(shouldShowStartTile('', mem(null))).toBe(true);
    expect(shouldShowStartTile('', mem('1'))).toBe(false);
    expect(shouldShowStartTile('?intro=off', mem(null))).toBe(false);
    expect(shouldShowStartTile('', { getItem: () => { throw new Error('blocked'); } })).toBe(true);
  });
});
