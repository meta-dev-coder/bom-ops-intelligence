import type { DataState, WeatherRecord, TrafficSegment } from './telemetry';

export type ScenarioPhase = 'IDLE' | 'RUNNING' | 'ACTIVE' | 'RESETTING' | 'ERROR';
export type ScenarioStepId = 'weather' | 'traffic' | 'demand' | 'impact' | 'recommendation';

export interface ScenarioStep {
  id: ScenarioStepId;
  label: string;
  description: string;
  weather?: Partial<Omit<WeatherRecord, 'kind'>>;
  traffic?: Record<string, Partial<Pick<TrafficSegment, 'currentSpeedKmh' | 'status'>>>;
  cabStagingOccupied?: Record<string, number>;
}

/** Spec §11.3 ScenarioDefinition. */
export interface ScenarioDefinition {
  id: string;
  name: string;
  version: string;
  baselineFixtureId: string;
  enabled: boolean;
  targetEntityId: string;
  roadEntityId: string;
  /** Clock time the scripted values are stamped with (ISO 8601, IST offset). */
  scenarioTime: string;
  stepDurationMs: number;
  steps: ScenarioStep[];
  assumptions: string[];
}

/** Spec §8.2: every run yields a self-describing, reproducible record. */
export interface ScenarioResult {
  runId: string;
  scenarioId: string;
  scenarioName: string;
  version: string;
  baselineFixtureId: string;
  createdAt: string;
  inputs: {
    weather: { precipitationMmPerHour: number; windSpeedKmh: number; condition: string; state: DataState };
    roads: { id: string; currentSpeedKmh: number; freeFlowSpeedKmh?: number; status: string; state: DataState }[];
    arrivals: { terminalId: string; flights: number; passengers: number }[];
  };
  assumptions: Record<string, unknown>;
  outputs: { terminalId: string; baselineIndex: number; index: number; band: string; pressureRatio: number; effectiveCapacityVehicles: number; dispatchDelayMinutes: number | null }[];
}
