/**
 * Turns a scenario result into a structured decision card (spec §4.5, §8.3, §9.1). The wording
 * is deliberately advisory: suggestions for an authorized human, never instructions, and no
 * claim of an actual queue time, closure or capacity breach.
 */
import modelConfig from '../config/model.json';
import type { AlertSeverity, RecommendationAlert, SourceStateRef } from '../types/alerts';
import type { ScenarioDefinition } from '../types/scenarios';
import { bandFor, describeAssumptions, type DemandPressureAssumptions } from './demandPressure';
import type { OperationalState } from './scenarioTypes';

const BAND_ORDER = ['Low', 'Moderate', 'High', 'Severe'];

export const SIMULATION_BANNER = 'SIMULATION — NOT AN OPERATIONAL INSTRUCTION';

export function buildScenarioAlert(args: {
  scenario: ScenarioDefinition;
  runCount: number;
  baseline: OperationalState;
  result: OperationalState;
  assumptions: DemandPressureAssumptions;
  createdAt: string;
  entityNames: Record<string, string>;
}): RecommendationAlert | null {
  const { scenario, baseline, result, assumptions } = args;
  const before = baseline.terminals[scenario.targetEntityId];
  const after = result.terminals[scenario.targetEntityId];
  if (!before || !after) return null;
  if (BAND_ORDER.indexOf(after.pressure.band) < BAND_ORDER.indexOf(modelConfig.alertMinBand)) return null;

  const road = result.traffic[scenario.roadEntityId];
  const terminalName = args.entityNames[scenario.targetEntityId] ?? scenario.targetEntityId;
  const roadName = args.entityNames[scenario.roadEntityId] ?? scenario.roadEntityId;
  const widebodies = after.arrivalsNextWindow.filter(f => f.aircraftCategory === 'WIDEBODY').length;
  const rain = result.weather.data.precipitationMmPerHour;
  const fmt = (n: number) => n.toLocaleString('en-IN');
  const severity = (modelConfig.bandSeverity as Record<string, AlertSeverity>)[after.pressure.band] ?? 'INFO';

  const sourceStates: SourceStateRef[] = [
    { input: 'Weather', sourceLabel: result.weather.sourceLabel, state: result.weather.state, observedAt: result.weather.observedAt },
    ...(road ? [{ input: 'Road speed', sourceLabel: road.sourceLabel, state: road.state, observedAt: road.observedAt }] : []),
    { input: 'Flight demand', sourceLabel: result.flights.sourceLabel, state: result.flights.state, observedAt: result.flights.observedAt },
  ];

  return {
    alertId: `${scenario.id}-run-${args.runCount}`,
    scenarioId: scenario.id,
    origin: 'SCENARIO',
    severity,
    title: `${terminalName} forecourt demand pressure elevated`,
    observation:
      `Simulated rainfall is ${rain} mm/h; configured ${roadName} speed is ${road?.data.currentSpeedKmh ?? '—'} km/h ` +
      `(${road?.data.status ?? 'unknown'}). ${after.arrivalsNextWindow.length} synthetic arrivals` +
      `${widebodies ? ` (${widebodies} widebody)` : ''} contribute an assumed ${fmt(after.arrivingPassengers)} passengers in the next ${assumptions.windowMinutes} minutes.`,
    impact:
      `Demand Pressure Index rises from ${before.pressure.index} (${before.pressure.band}) to ${after.pressure.index} (${after.pressure.band}) ` +
      `over the next ${assumptions.windowMinutes} minutes under the current fixture assumptions. This is an illustrative model result, not an observed airport condition.`,
    contributingFactors: [
      `Flight demand: ${fmt(after.arrivingPassengers)} assumed arriving passengers → ${Math.round(after.pressure.pickupVehicles)} pickup vehicles + ${Math.round(after.pressure.projectedVehicleDemand - after.pressure.pickupVehicles)} drop-off vehicles`,
      `Road speed: ${road?.data.currentSpeedKmh ?? '—'} of ${road?.data.freeFlowSpeedKmh ?? '—'} km/h free-flow → road capacity factor ×${after.pressure.roadCapacityFactor.toFixed(2)}`,
      `Weather severity: ${rain} mm/h → capacity factor ×${after.pressure.weatherCapacityFactor}`,
      `Relevant facility: ${terminalName} arrivals forecourt; cab staging ${after.cabStaging.occupied}/${after.cabStaging.capacity}`,
    ],
    recommendations: [
      'Review alternate commercial pickup/staging arrangements, subject to airport policy and available capacity.',
      'Assess whether additional arrivals-forecourt coordination is warranted.',
      'Prepare passenger communications through authorized airline/airport channels if operationally approved.',
    ],
    assumptions: [...scenario.assumptions, ...describeAssumptions(assumptions)],
    entityIds: [scenario.targetEntityId, scenario.roadEntityId],
    sourceStates,
    status: 'NEW',
    notes: [],
    createdAt: args.createdAt,
    archived: false,
  };
}

export { bandFor };
