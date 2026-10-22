/** Builds the §8.2 scenario record: scenario id, version, inputs, assumption set, outputs, timestamp. */
import type { ScenarioDefinition, ScenarioResult } from '../types/scenarios';
import type { DemandPressureAssumptions } from './demandPressure';
import type { OperationalState } from './scenarioTypes';

const round = (n: number, d = 3) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : n);

export function buildScenarioResult(args: {
  scenario: ScenarioDefinition;
  runCount: number;
  baseline: OperationalState;
  result: OperationalState;
  assumptions: DemandPressureAssumptions;
  baselineFixtureId: string;
  createdAt: string;
}): ScenarioResult {
  const { scenario, baseline, result } = args;
  return {
    runId: `${scenario.id}-run-${args.runCount}`,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    version: scenario.version,
    baselineFixtureId: args.baselineFixtureId,
    createdAt: args.createdAt,
    inputs: {
      weather: {
        precipitationMmPerHour: result.weather.data.precipitationMmPerHour,
        windSpeedKmh: result.weather.data.windSpeedKmh,
        condition: result.weather.data.condition,
        state: result.weather.state,
      },
      roads: Object.values(result.traffic).map(env => ({
        id: env.data.id, currentSpeedKmh: env.data.currentSpeedKmh, freeFlowSpeedKmh: env.data.freeFlowSpeedKmh,
        status: env.data.status, state: env.state,
      })),
      arrivals: Object.values(result.terminals).map(t => ({ terminalId: t.terminalId, flights: t.arrivalsNextWindow.length, passengers: t.arrivingPassengers })),
    },
    assumptions: { ...args.assumptions },
    outputs: Object.values(result.terminals).map(t => ({
      terminalId: t.terminalId,
      baselineIndex: baseline.terminals[t.terminalId]?.pressure.index ?? t.pressure.index,
      index: t.pressure.index,
      band: t.pressure.band,
      pressureRatio: round(t.pressure.pressureRatio),
      effectiveCapacityVehicles: round(t.pressure.effectiveCapacityVehicles, 1),
      dispatchDelayMinutes: t.pressure.dispatchDelayMinutes == null ? null : round(t.pressure.dispatchDelayMinutes, 1),
    })),
  };
}
