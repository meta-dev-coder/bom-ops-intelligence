/**
 * Guided demo flow — the presenter script from spec Appendix B.3, as data. Pattern from
 * acs-demo (cesium-poc uc1Mode.js startup tile + stepper, root GuidedTour.tsx Skip/Back/Next):
 * every step can be read and skipped, done for the user ("Do it for me"), or completed by the
 * user's own action, which advances the flow. `isStepDone` is pure so the flow is testable.
 */
import { SCENARIO_MONSOON } from '../data/MockDataService';

export type DemoAction = 'selectT2' | 'selectRoad' | 'runScenario' | 'openAlert' | 'resetScenario';

export interface DemoStep {
  id: string;
  label: string;
  title: string;
  /** What to say / notice. */
  body: string;
  /** The one thing to do on this step; absent for read-only steps. */
  instruction?: string;
  action?: DemoAction;
  actionLabel?: string;
  /** `data-tour` value of the element to spotlight. */
  target?: string;
}

export interface DemoSnapshot {
  selectedEntityId: string | null;
  phase: string;
  stepIndex: number;
  alertExpanded: boolean;
  hasActiveAlert: boolean;
  hasArchivedAlert: boolean;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: 'mode', label: 'Data state', target: 'data-sources',
    title: 'Every value says where it came from',
    body: 'The guided demo runs in Simulation mode on a fixed evening-peak slice, so it is identical every time. Each panel carries a tag: LIVE (green), STALE (amber) or SIMULATION (violet); the Data sources panel lists every feed. Real mode (Settings) switches to live weather and aircraft.',
  },
  {
    id: 't2', label: 'Terminal 2', target: 'terminal-t2',
    title: 'Select Terminal 2',
    body: 'The inspector switches to T2: a Demand Pressure Index of 42 / 100 (Moderate) from ~1,200 assumed passengers on four synthetic widebody arrivals in the next 30 minutes. Open the ⓘ on any KPI for its definition.',
    instruction: 'Click Terminal 2 on the map or in the Facilities list.',
    action: 'selectT2', actionLabel: 'Select T2 for me',
  },
  {
    id: 'road', label: 'Sahar road', target: 'road-sahar-inbound',
    title: 'Select the Sahar Elevated Access Road',
    body: 'Road inspector: current vs free-flow speed, speed ratio, travel-time ratio and blockage state — and its link to T2. This segment feeds the T2 road-capacity factor.',
    instruction: 'Click the inbound Sahar road on the map or in Landside traffic.',
    action: 'selectRoad', actionLabel: 'Select the road for me',
  },
  {
    id: 'run', label: 'Run scenario', target: 'run-scenario',
    title: 'Run the monsoon scenario',
    body: 'Watch the scripted sequence: rainfall to 50 mm/h, the Sahar inbound road to 5 km/h and red, then the model re-runs and T2 pulses amber as its index moves 42 → 86 (Severe).',
    instruction: 'Click "Run scenario" in the right panel.',
    action: 'runScenario', actionLabel: 'Run it for me',
  },
  {
    id: 'alert', label: 'Recommendation', target: 'alert',
    title: 'Open the recommendation',
    body: 'A structured decision card, not a ticker: observation, estimated impact, contributing factors, suggested actions for an authorized human to review, assumptions and data provenance. Nothing is executed.',
    instruction: 'Click "View details" on the alert at the bottom.',
    action: 'openAlert', actionLabel: 'Open it for me',
  },
  {
    id: 'reset', label: 'Reset', target: 'reset-scenario',
    title: 'Reset — and replay',
    body: 'Reset restores the exact baseline: weather, road, KPIs, overlays and aircraft. The alert is archived in History. Run it again and you get the same numbers — the demo is repeatable.',
    instruction: 'Click "Reset" in the scenario panel.',
    action: 'resetScenario', actionLabel: 'Reset for me',
  },
];

export function isStepDone(step: DemoStep, s: DemoSnapshot): boolean {
  switch (step.id) {
    case 't2': return s.selectedEntityId === SCENARIO_MONSOON.targetEntityId;
    case 'road': return s.selectedEntityId === SCENARIO_MONSOON.roadEntityId;
    case 'run': return s.phase === 'ACTIVE';
    case 'alert': return s.hasActiveAlert && s.alertExpanded;
    case 'reset': return s.phase === 'IDLE' && s.stepIndex === 0 && s.hasArchivedAlert;
    default: return false;
  }
}

export const DEMO_SEEN_KEY = 'bom_demo_seen_v1';

/** First visit shows the start tile; `?intro=off` (acs-demo convention) or a stored flag skips it. */
export function shouldShowStartTile(search: string, storage: Pick<Storage, 'getItem'> | null): boolean {
  if (new URLSearchParams(search).get('intro') === 'off') return false;
  try {
    return storage?.getItem(DEMO_SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}
