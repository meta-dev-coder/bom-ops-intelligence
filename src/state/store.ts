/**
 * Single application store (spec §11.1: scenario, selection, data state and alerts explicit).
 * Cesium objects never live here — only ids and plain data — so the map modules subscribe to it
 * from outside React and React never re-renders the globe.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import { can, roleLabel, type Permission, type RoleId } from '../config/roles';
import { ENV } from '../config/environment';
import { mockBaseline, SCENARIO_MONSOON } from '../data/MockDataService';
import { ENTITY_NAMES } from '../map/EntityRegistry';
import { buildScenarioAlert } from '../simulation/alertRules';
import { DEFAULT_ASSUMPTIONS, type DemandPressureAssumptions } from '../simulation/demandPressure';
import { deriveOperationalState } from '../simulation/operationalState';
import { createScenarioRunner, INITIAL_MACHINE, reduceScenario, type ScenarioEvent, type ScenarioMachine } from '../simulation/ScenarioEngine';
import type { BaselineInputs, OperationalState } from '../simulation/scenarioTypes';
import type { AlertStatus, EventKind, EventLogEntry, RecommendationAlert } from '../types/alerts';
import type { ScenarioResult } from '../types/scenarios';
import type { DataEnvelope, LiveAircraft, ProviderHealth } from '../types/telemetry';
import { DATA_CONFIG } from '../config/dataSources';
import { BASELINE_FIXTURE } from '../data/MockDataService';
import { buildScenarioResult } from '../simulation/scenarioResult';

export type DataMode = 'MOCK' | 'LIVE';
export type LayerKey = 'buildings' | 'photoreal' | 'aircraft' | 'roads' | 'facilities' | 'runways';
export type DemoMode = 'off' | 'start' | 'guided';
export type LayerStatus = { state: 'loading' | 'ready' | 'error' | 'off'; message?: string };

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export interface AppState {
  role: RoleId;
  dataMode: DataMode;
  baseline: BaselineInputs;
  /** Baseline snapshot taken when a scenario starts; live refreshes never move a running scenario. */
  frozenBaseline: BaselineInputs | null;
  providerHealth: ProviderHealth[];
  /** Real mode only: live ADS-B positions (null in Simulation mode). */
  liveAircraft: DataEnvelope<LiveAircraft[]> | null;
  assumptions: DemandPressureAssumptions;
  machine: ScenarioMachine;
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  alerts: RecommendationAlert[];
  events: EventLogEntry[];
  layers: Record<LayerKey, boolean>;
  layerStatus: Partial<Record<LayerKey | 'terrain' | 'imagery', LayerStatus>>;
  reducedMotion: boolean;
  ui: { left: boolean; right: boolean; alertExpanded: boolean; settings: boolean; history: boolean; legend: boolean };
  /** Incremented to ask the map to fly somewhere; `null` entity = home view. */
  focusRequest: { entityId: string | null; nonce: number };
  aircraftResetNonce: number;
  demo: { mode: DemoMode; step: number };
  /** One §8.2 record per completed run (session only). */
  scenarioResults: ScenarioResult[];
  settings: { soundEnabled: boolean; sceneMode: '3D' | '2D'; refreshSeconds: number };

  setRole(r: RoleId): void;
  setDataMode(m: DataMode): void;
  setBaseline(b: BaselineInputs): void;
  setProviderHealth(h: ProviderHealth[]): void;
  setLiveAircraft(a: DataEnvelope<LiveAircraft[]> | null): void;
  setAssumptions(a: DemandPressureAssumptions): void;
  select(id: string | null): void;
  hover(id: string | null): void;
  focus(id: string | null): void;
  toggleLayer(k: LayerKey): void;
  setLayerStatus(k: LayerKey | 'terrain' | 'imagery', s: LayerStatus): void;
  setUi(patch: Partial<AppState['ui']>): void;
  setReducedMotion(v: boolean): void;
  runScenario(): void;
  resetScenario(): void;
  setAlertStatus(alertId: string, status: AlertStatus): void;
  assignAlert(alertId: string, owner: string): void;
  addNote(alertId: string, text: string): void;
  setDemo(patch: Partial<AppState['demo']>): void;
  /** Puts the app in the known starting state for the presenter script, then opens step 1. */
  startGuidedDemo(): void;
  setSoundEnabled(v: boolean): void;
  setSceneMode(m: '3D' | '2D'): void;
  /** Admin: provider refresh interval (logged as a configuration change). */
  setRefreshSeconds(s: number): void;
  /** Demo Operator: back to a clean presentation state (scenario, alerts, history, parameters, layers). */
  resetEnvironment(): void;
}

let eventSeq = 0;

export const useApp = create<AppState>((set, get) => {
  const log = (kind: EventKind, detail: string, alertId?: string, actor?: RoleId) =>
    set(s => ({
      events: [{ id: ++eventSeq, at: new Date().toISOString(), kind, actorRole: roleLabel(actor ?? s.role), detail, alertId }, ...s.events].slice(0, 200),
    }));

  const guard = (p: Permission) => {
    if (!can(get().role, p)) {
      console.warn(`[roles] ${get().role} lacks ${p}`);
      return false;
    }
    return true;
  };

  const dispatch = (e: ScenarioEvent) => set(s => ({ machine: reduceScenario(s.machine, e, SCENARIO_MONSOON.steps.length) }));

  const runner = createScenarioRunner({
    getMachine: () => get().machine,
    dispatch,
    totalSteps: () => SCENARIO_MONSOON.steps.length,
    stepDurationMs: () => (get().reducedMotion ? 150 : SCENARIO_MONSOON.stepDurationMs),
    onStep: stepIndex => {
      const step = SCENARIO_MONSOON.steps[stepIndex - 1];
      if (step?.id === 'recommendation') {
        const s = get();
        const base = s.frozenBaseline ?? s.baseline;
        const alert = buildScenarioAlert({
          scenario: SCENARIO_MONSOON,
          runCount: s.machine.runCount,
          baseline: deriveOperationalState(base, SCENARIO_MONSOON, 0, s.assumptions),
          result: deriveOperationalState(base, SCENARIO_MONSOON, stepIndex, s.assumptions),
          assumptions: s.assumptions,
          createdAt: new Date().toISOString(),
          entityNames: ENTITY_NAMES,
        });
        if (alert) {
          set(st => ({ alerts: [alert, ...st.alerts.filter(a => a.alertId !== alert.alertId)], ui: { ...st.ui, alertExpanded: false } }));
          log('ALERT_CREATED', `${alert.severity}: ${alert.title}`, alert.alertId);
        }
      }
      if (get().machine.phase === 'ACTIVE') {
        const s = get();
        const base = s.frozenBaseline ?? s.baseline;
        const result = buildScenarioResult({
          scenario: SCENARIO_MONSOON,
          runCount: s.machine.runCount,
          baseline: deriveOperationalState(base, SCENARIO_MONSOON, 0, s.assumptions),
          result: deriveOperationalState(base, SCENARIO_MONSOON, s.machine.stepIndex, s.assumptions),
          assumptions: s.assumptions,
          baselineFixtureId: base.fixtureId,
          createdAt: new Date().toISOString(),
        });
        set(st => ({ scenarioResults: [result, ...st.scenarioResults].slice(0, 20) }));
        log('SCENARIO_ACTIVE', `${SCENARIO_MONSOON.name} — all steps applied (record ${result.runId})`);
      }
    },
  });

  /** Restores the baseline. Role checks happen in the callers; a data-mode switch resets as a system step. */
  const doReset = (detail: string) => {
    const wasIdle = get().machine.phase === 'IDLE' && get().machine.stepIndex === 0;
    runner.reset();
    set(s => ({
      frozenBaseline: null,
      alerts: s.alerts.map(a => (a.origin === 'SCENARIO' ? { ...a, archived: true } : a)),
      aircraftResetNonce: s.aircraftResetNonce + 1,
      ui: { ...s.ui, alertExpanded: false },
    }));
    if (!wasIdle) log('SCENARIO_RESET', detail);
  };

  return {
    role: 'ANALYST',
    dataMode: ENV.defaultDataMode,
    baseline: mockBaseline(),
    frozenBaseline: null,
    providerHealth: [],
    liveAircraft: null,
    assumptions: DEFAULT_ASSUMPTIONS,
    machine: INITIAL_MACHINE,
    selectedEntityId: null,
    hoveredEntityId: null,
    alerts: [],
    events: [],
    layers: { buildings: true, photoreal: false, aircraft: true, roads: true, facilities: true, runways: true },
    layerStatus: {},
    reducedMotion: prefersReducedMotion(),
    ui: { left: true, right: true, alertExpanded: false, settings: false, history: false, legend: false },
    focusRequest: { entityId: null, nonce: 0 },
    aircraftResetNonce: 0,
    demo: { mode: 'off', step: 0 },
    scenarioResults: [],
    settings: { soundEnabled: false, sceneMode: '3D', refreshSeconds: DATA_CONFIG.refreshSeconds },

    setRole: role => {
      const previous = get().role;
      if (role === previous) return;
      set({ role });
      log('ROLE_CHANGED', `Role changed to ${roleLabel(role)}`, undefined, previous);
    },
    setDataMode: mode => {
      if (!guard('dataMode.switch') || mode === get().dataMode) return;
      if (mode === 'LIVE' && !ENV.realDataAvailable) return; // no /api proxy on this static host
      doReset('Baseline restored because the data mode changed; scenario alert archived');
      set({ dataMode: mode, baseline: mode === 'MOCK' ? mockBaseline() : get().baseline });
      log('DATA_MODE_CHANGED', `Data mode → ${mode}`);
    },
    setBaseline: baseline => set({ baseline }),
    setProviderHealth: providerHealth => set({ providerHealth }),
    setLiveAircraft: liveAircraft => set({ liveAircraft }),
    setAssumptions: a => {
      if (!guard('assumptions.edit')) return;
      set({ assumptions: a });
      log('ASSUMPTIONS_CHANGED', 'Scenario model assumptions updated');
    },
    select: id => set({ selectedEntityId: id }),
    hover: id => (get().hoveredEntityId === id ? undefined : set({ hoveredEntityId: id })),
    focus: id => set(s => ({ focusRequest: { entityId: id, nonce: s.focusRequest.nonce + 1 } })),
    toggleLayer: k => set(s => {
      const layers = { ...s.layers, [k]: !s.layers[k] };
      // OSM Buildings and Google Photorealistic overlap and z-fight: never show both.
      if (k === 'photoreal' && layers.photoreal) layers.buildings = false;
      if (k === 'buildings' && layers.buildings) layers.photoreal = false;
      return { layers };
    }),
    setLayerStatus: (k, st) => set(s => ({ layerStatus: { ...s.layerStatus, [k]: st } })),
    setUi: patch => set(s => ({ ui: { ...s.ui, ...patch } })),
    setReducedMotion: reducedMotion => set({ reducedMotion }),

    runScenario: () => {
      if (!guard('scenario.run') || get().machine.phase !== 'IDLE') return;
      set(s => ({ frozenBaseline: s.baseline, selectedEntityId: SCENARIO_MONSOON.targetEntityId }));
      if (runner.run()) log('SCENARIO_RUN', `${SCENARIO_MONSOON.name} v${SCENARIO_MONSOON.version} started (baseline snapshot saved)`);
    },
    resetScenario: () => {
      if (!guard('scenario.run')) return;
      doReset('Baseline restored; scenario alert archived to history');
    },
    setSoundEnabled: v => set(s => ({ settings: { ...s.settings, soundEnabled: v } })),
    setSceneMode: m => set(s => ({ settings: { ...s.settings, sceneMode: m } })),
    setRefreshSeconds: sec => {
      if (!guard('config.edit') || !Number.isFinite(sec) || sec < 30 || sec > 900) return;
      const prev = get().settings.refreshSeconds;
      if (prev === sec) return;
      set(s => ({ settings: { ...s.settings, refreshSeconds: sec } }));
      log('CONFIG_CHANGED', `Provider refresh interval ${prev}s → ${sec}s`);
    },
    resetEnvironment: () => {
      if (!guard('environment.reset')) return;
      runner.reset();
      set(s => ({
        frozenBaseline: null,
        baseline: s.dataMode === 'MOCK' ? mockBaseline() : s.baseline,
        alerts: [], events: [], scenarioResults: [],
        assumptions: DEFAULT_ASSUMPTIONS,
        layers: { buildings: true, photoreal: false, aircraft: true, roads: true, facilities: true, runways: true },
        selectedEntityId: null, hoveredEntityId: null,
        demo: { mode: 'off', step: 0 },
        aircraftResetNonce: s.aircraftResetNonce + 1,
        focusRequest: { entityId: null, nonce: s.focusRequest.nonce + 1 },
        ui: { ...s.ui, alertExpanded: false, history: false },
        settings: { ...s.settings, sceneMode: '3D' },
      }));
      log('ENVIRONMENT_RESET', `Environment reset to fixture ${BASELINE_FIXTURE.fixtureId}`);
    },
    setDemo: patch => set(s => ({ demo: { ...s.demo, ...patch } })),
    startGuidedDemo: () => {
      doReset('Baseline restored for the guided demo');
      const s = get();
      // The script needs Mock Mode and a role that can run scenarios; switching is logged, not silent.
      if (s.role !== 'ANALYST' && !can(s.role, 'scenario.run')) {
        log('ROLE_CHANGED', 'Role changed to Operations Analyst for the guided demo', undefined, s.role);
        set({ role: 'ANALYST' });
      }
      if (s.dataMode !== 'MOCK') {
        set({ dataMode: 'MOCK', baseline: mockBaseline() });
        log('DATA_MODE_CHANGED', 'Data mode → MOCK for the guided demo');
      }
      set(st => ({ selectedEntityId: null, demo: { mode: 'guided', step: 0 }, ui: { ...st.ui, left: window.innerWidth >= 1024 || st.ui.left, right: true }, focusRequest: { entityId: null, nonce: st.focusRequest.nonce + 1 } }));
    },
    setAlertStatus: (alertId, status) => {
      const need: Permission = status === 'ACKNOWLEDGED' ? 'alert.acknowledge' : 'alert.resolve';
      if (!guard(need)) return;
      set(s => ({ alerts: s.alerts.map(a => (a.alertId === alertId ? { ...a, status } : a)) }));
      log('ALERT_STATUS', `Alert → ${status}`, alertId);
    },
    assignAlert: (alertId, owner) => {
      if (!guard('alert.assign') || !owner.trim()) return;
      set(s => ({ alerts: s.alerts.map(a => (a.alertId === alertId ? { ...a, owner: owner.trim(), status: 'ASSIGNED' } : a)) }));
      log('ALERT_ASSIGNED', `Assigned to ${owner.trim()}`, alertId);
    },
    addNote: (alertId, text) => {
      if (!guard('alert.note') || !text.trim()) return;
      const note = { at: new Date().toISOString(), by: roleLabel(get().role), text: text.trim() };
      set(s => ({ alerts: s.alerts.map(a => (a.alertId === alertId ? { ...a, notes: [...a.notes, note] } : a)) }));
      log('ALERT_NOTE', `Note added`, alertId);
    },
  };
});

/** Derived view used by every panel and the map. Pure, memoised on its inputs. */
export function useOperational(): { current: OperationalState; baseline: OperationalState } {
  const base = useApp(s => s.frozenBaseline ?? s.baseline);
  const stepIndex = useApp(s => s.machine.stepIndex);
  const assumptions = useApp(s => s.assumptions);
  return useMemo(() => ({
    current: deriveOperationalState(base, SCENARIO_MONSOON, stepIndex, assumptions),
    baseline: deriveOperationalState(base, SCENARIO_MONSOON, 0, assumptions),
  }), [base, stepIndex, assumptions]);
}

/** Non-React access for the map layer. */
export function selectOperational(s: AppState): OperationalState {
  return deriveOperationalState(s.frozenBaseline ?? s.baseline, SCENARIO_MONSOON, s.machine.stepIndex, s.assumptions);
}

export const useCan = (p: Permission) => useApp(s => can(s.role, p));

/** Real mode with no scenario running: non-live values are presented as estimates, not SIMULATION. */
export const useRealQuiet = () => useApp(s => s.dataMode === 'LIVE' && s.machine.phase === 'IDLE' && s.machine.stepIndex === 0);
