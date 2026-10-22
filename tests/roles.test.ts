import { describe, expect, it } from 'vitest';
import { can } from '../src/config/roles';

describe('role permissions (FR-12)', () => {
  it('Viewer can only look', () => {
    expect(can('VIEWER', 'scenario.run')).toBe(false);
    expect(can('VIEWER', 'alert.acknowledge')).toBe(false);
  });
  it('Analyst runs scenarios and acknowledges, but cannot assign or resolve', () => {
    expect(can('ANALYST', 'scenario.run')).toBe(true);
    expect(can('ANALYST', 'alert.acknowledge')).toBe(true);
    expect(can('ANALYST', 'alert.assign')).toBe(false);
    expect(can('ANALYST', 'alert.resolve')).toBe(false);
  });
  it('Supervisor adds assign/resolve and assumption edits, but not provider config', () => {
    expect(can('SUPERVISOR', 'alert.resolve')).toBe(true);
    expect(can('SUPERVISOR', 'assumptions.edit')).toBe(true);
    expect(can('SUPERVISOR', 'dataMode.switch')).toBe(false);
  });
  it('Admin configures data mode but does not operate scenarios', () => {
    expect(can('ADMIN', 'dataMode.switch')).toBe(true);
    expect(can('ADMIN', 'scenario.run')).toBe(false);
  });
});
