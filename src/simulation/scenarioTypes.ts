import type { DataEnvelope, FlightRecord, TrafficSegment, WeatherRecord } from '../types/telemetry';
import type { DemandPressureResult } from './demandPressure';

export interface TerminalFixture {
  roadEntityId: string | null;
  departingDropoffVehicles: number;
  cabStaging: { occupied: number; capacity: number };
  apronStands?: { occupied: number; total: number };
}

/** Everything the scenario is derived from. A scenario never mutates this (spec §8.2). */
export interface BaselineInputs {
  fixtureId: string;
  windowStart: string;
  weather: DataEnvelope<WeatherRecord>;
  traffic: Record<string, DataEnvelope<TrafficSegment>>;
  flights: DataEnvelope<FlightRecord[]>;
  terminals: Record<string, TerminalFixture>;
  parking: Record<string, { occupied: number; capacityAssumed: number }>;
  facilities: Record<string, { status: string }>;
}

export interface TerminalKpis {
  terminalId: string;
  arrivalsNextWindow: (FlightRecord & { estimatedPassengers: number })[];
  arrivingPassengers: number;
  pressure: DemandPressureResult;
  cabStaging: { occupied: number; capacity: number; utilisationPct: number };
  apronStands?: { occupied: number; total: number; occupancyPct: number };
}

export interface OperationalState {
  weather: DataEnvelope<WeatherRecord>;
  traffic: Record<string, DataEnvelope<TrafficSegment>>;
  flights: DataEnvelope<FlightRecord[]>;
  terminals: Record<string, TerminalKpis>;
  parking: BaselineInputs['parking'];
  facilities: BaselineInputs['facilities'];
  appliedStepIds: string[];
  /** True once the scenario's Impact step has run and KPIs reflect scenario inputs. */
  impactApplied: boolean;
}
