/**
 * Pure derivation: baseline + scenario + number of applied steps → what every panel shows.
 * The scenario is always re-derived from the untouched baseline, so reset is just "0 steps"
 * and the same inputs always give the same outputs (spec §8.2).
 */
import type { ScenarioDefinition } from '../types/scenarios';
import type { DataEnvelope, FlightRecord, TrafficSegment, WeatherRecord } from '../types/telemetry';
import { computeDemandPressure, type DemandPressureAssumptions } from './demandPressure';
import type { BaselineInputs, OperationalState, TerminalKpis } from './scenarioTypes';

export const estimatedPassengers = (f: FlightRecord) => Math.round(f.seatsAssumed * f.loadFactorAssumed);

function scripted<T extends object>(env: DataEnvelope<T>, patch: Partial<T>, s: ScenarioDefinition): DataEnvelope<T> {
  return {
    ...env,
    data: { ...env.data, ...patch },
    state: 'SIMULATION',
    sourceId: s.id,
    sourceLabel: `Scenario: ${s.name}`,
    observedAt: s.scenarioTime,
    fetchedAt: s.scenarioTime,
    quality: 'Scripted scenario input — not observed',
    errorCode: undefined,
  };
}

export function terminalKpis(
  terminalId: string,
  inputs: Pick<OperationalState, 'weather' | 'traffic' | 'flights'>,
  fixture: BaselineInputs['terminals'][string],
  assumptions: DemandPressureAssumptions,
  cabOccupied = fixture.cabStaging.occupied,
): TerminalKpis {
  const arrivals = inputs.flights.data
    .filter(f => f.terminalId === terminalId && f.etaOffsetMinutes >= 0 && f.etaOffsetMinutes < assumptions.windowMinutes)
    .sort((a, b) => a.etaOffsetMinutes - b.etaOffsetMinutes)
    .map(f => ({ ...f, estimatedPassengers: estimatedPassengers(f) }));
  const arrivingPassengers = arrivals.reduce((s, f) => s + f.estimatedPassengers, 0);
  const road = fixture.roadEntityId ? inputs.traffic[fixture.roadEntityId]?.data : undefined;
  const pressure = computeDemandPressure({
    arrivingPassengers,
    departingDropoffVehicles: fixture.departingDropoffVehicles,
    roadCurrentSpeedKmh: road?.currentSpeedKmh,
    roadFreeFlowSpeedKmh: road?.freeFlowSpeedKmh,
    rainfallMmPerHour: inputs.weather.data.precipitationMmPerHour,
  }, assumptions);
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  return {
    terminalId,
    arrivalsNextWindow: arrivals,
    arrivingPassengers,
    pressure,
    cabStaging: { occupied: cabOccupied, capacity: fixture.cabStaging.capacity, utilisationPct: pct(cabOccupied, fixture.cabStaging.capacity) },
    apronStands: fixture.apronStands
      ? { ...fixture.apronStands, occupancyPct: pct(fixture.apronStands.occupied, fixture.apronStands.total) }
      : undefined,
  };
}

export function deriveOperationalState(
  baseline: BaselineInputs,
  scenario: ScenarioDefinition | null,
  appliedStepCount: number,
  assumptions: DemandPressureAssumptions,
): OperationalState {
  const steps = scenario ? scenario.steps.slice(0, Math.max(0, appliedStepCount)) : [];
  let weather = baseline.weather;
  const traffic = { ...baseline.traffic };
  const cabOverrides: Record<string, number> = {};
  for (const step of steps) {
    if (step.weather) weather = scripted<WeatherRecord>(weather, { ...step.weather, kind: 'SCRIPTED' }, scenario!);
    for (const [id, patch] of Object.entries(step.traffic ?? {})) {
      if (traffic[id]) traffic[id] = scripted<TrafficSegment>(traffic[id], patch, scenario!);
    }
    Object.assign(cabOverrides, step.cabStagingOccupied ?? {});
  }
  const impactApplied = steps.some(s => s.id === 'impact');
  // Until Impact runs, KPIs stay on baseline inputs even though cards show the scripted values.
  const kpiInputs = impactApplied
    ? { weather, traffic, flights: baseline.flights }
    : { weather: baseline.weather, traffic: baseline.traffic, flights: baseline.flights };

  const terminals: Record<string, TerminalKpis> = {};
  for (const [id, fx] of Object.entries(baseline.terminals)) {
    terminals[id] = terminalKpis(id, kpiInputs, fx, assumptions, cabOverrides[id] ?? fx.cabStaging.occupied);
  }
  return {
    weather, traffic, flights: baseline.flights, terminals,
    parking: baseline.parking, facilities: baseline.facilities,
    appliedStepIds: steps.map(s => s.id),
    impactApplied,
  };
}
