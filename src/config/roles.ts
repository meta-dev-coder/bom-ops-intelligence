/** Spec §10 — a lightweight demo role selector, explicitly not production security. */
export type RoleId = 'VIEWER' | 'ANALYST' | 'SUPERVISOR' | 'ADMIN' | 'DEMO_OPERATOR';

export type Permission =
  | 'scenario.run' | 'alert.acknowledge' | 'alert.note' | 'alert.assign' | 'alert.resolve'
  | 'assumptions.edit' | 'dataMode.switch' | 'diagnostics.view'
  | 'config.edit' | 'fixtures.view' | 'environment.reset';

export const ROLES: { id: RoleId; label: string }[] = [
  { id: 'VIEWER', label: 'Viewer / Executive' },
  { id: 'ANALYST', label: 'Operations Analyst' },
  { id: 'SUPERVISOR', label: 'Operations Supervisor' },
  { id: 'ADMIN', label: 'System Administrator' },
  { id: 'DEMO_OPERATOR', label: 'Developer / Demo Operator' },
];

/** Whether a Viewer may replay scenarios ("if allowed by configuration", §10). */
export const VIEWER_CAN_REPLAY = false;

const ANALYST: Permission[] = ['scenario.run', 'alert.acknowledge', 'alert.note'];
const SUPERVISOR: Permission[] = [...ANALYST, 'alert.assign', 'alert.resolve', 'assumptions.edit'];

export const PERMISSIONS: Record<RoleId, Permission[]> = {
  VIEWER: VIEWER_CAN_REPLAY ? ['scenario.run'] : [],
  ANALYST,
  SUPERVISOR,
  ADMIN: ['dataMode.switch', 'diagnostics.view', 'config.edit'],
  DEMO_OPERATOR: ['scenario.run', 'alert.acknowledge', 'alert.note', 'dataMode.switch', 'diagnostics.view', 'fixtures.view', 'environment.reset'],
};

export const can = (role: RoleId, p: Permission) => PERMISSIONS[role].includes(p);
export const roleLabel = (role: RoleId) => ROLES.find(r => r.id === role)?.label ?? role;
