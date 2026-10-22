/**
 * Deterministic local fixtures (spec §7.2): the presentation default. Every record is SIMULATION
 * and stamped with the fixture's window time, never the wall clock, so two loads are identical.
 */
import baseline from './fixtures/bom-baseline.json';
import scenarioMonsoon from './fixtures/bom-scenario-monsoon.json';
import { DATA_CONFIG } from '../config/dataSources';
import type { BaselineInputs, TerminalFixture } from '../simulation/scenarioTypes';
import type { ScenarioDefinition } from '../types/scenarios';
import type { DataEnvelope, FlightRecord, TrafficSegment, WeatherRecord } from '../types/telemetry';

export const BASELINE_FIXTURE = baseline;
export const SCENARIO_MONSOON = scenarioMonsoon as ScenarioDefinition;

function sim<T>(data: T, staleAfterSeconds: number): DataEnvelope<T> {
  return {
    data,
    sourceId: baseline.fixtureId,
    sourceLabel: baseline.sourceLabel,
    state: 'SIMULATION',
    observedAt: baseline.windowStart,
    fetchedAt: baseline.windowStart,
    staleAfterSeconds,
    quality: 'Synthetic fixture',
  };
}

export const mockWeather = (): DataEnvelope<WeatherRecord> =>
  sim(baseline.weather as WeatherRecord, DATA_CONFIG.weather.staleAfterSeconds);

export const mockTraffic = (): Record<string, DataEnvelope<TrafficSegment>> =>
  Object.fromEntries((baseline.traffic as TrafficSegment[]).map(t => [t.id, sim(t, DATA_CONFIG.traffic.staleAfterSeconds)]));

export const mockFlights = (): DataEnvelope<FlightRecord[]> =>
  sim(baseline.flights as FlightRecord[], Number.POSITIVE_INFINITY);

export function mockBaseline(): BaselineInputs {
  return {
    fixtureId: baseline.fixtureId,
    windowStart: baseline.windowStart,
    weather: mockWeather(),
    traffic: mockTraffic(),
    flights: mockFlights(),
    terminals: baseline.terminals as Record<string, TerminalFixture>,
    parking: baseline.parking,
    facilities: baseline.facilities,
  };
}
