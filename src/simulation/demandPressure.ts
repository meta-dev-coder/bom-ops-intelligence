/**
 * Transparent, rules-based forecourt demand-pressure model (spec §6.1). Pure: inputs and
 * assumptions in, every intermediate value out, so the UI can show its working. The output is a
 * Demand Pressure Index — not a predicted queue time or a capacity breach.
 */
import modelConfig from '../config/model.json';

export type PressureBand = 'Low' | 'Moderate' | 'High' | 'Severe';

export interface DemandPressureAssumptions {
  windowMinutes: number;
  pickupShare: number;
  passengersPerVehicle: number;
  baselineVehiclesPerHour: number;
  roadCapacityFloor: number;
  rainCapacityFactors: { minMmPerHour: number; factor: number }[];
  indexFullScaleRatio: number;
  baseServiceMinutes: number;
  bands: { label: string; minIndex: number }[];
}

export interface DemandPressureInputs {
  arrivingPassengers: number;
  departingDropoffVehicles: number;
  /** Omit both for a terminal with no configured access road (road factor = 1). */
  roadCurrentSpeedKmh?: number;
  roadFreeFlowSpeedKmh?: number;
  rainfallMmPerHour: number;
}

export interface DemandPressureResult {
  pickupVehicles: number;
  projectedVehicleDemand: number;
  speedRatio: number | null;
  roadCapacityFactor: number;
  weatherCapacityFactor: number;
  effectiveCapacityVehicles: number;
  pressureRatio: number;
  index: number;
  band: PressureBand;
  excessVehicles: number;
  /** Illustrative rule: base service time + time to clear the excess at effective capacity. Null when capacity is zero. */
  dispatchDelayMinutes: number | null;
}

export const DEFAULT_ASSUMPTIONS: DemandPressureAssumptions = {
  windowMinutes: modelConfig.windowMinutes,
  pickupShare: modelConfig.pickupShare,
  passengersPerVehicle: modelConfig.passengersPerVehicle,
  baselineVehiclesPerHour: modelConfig.baselineVehiclesPerHour,
  roadCapacityFloor: modelConfig.roadCapacityFloor,
  rainCapacityFactors: modelConfig.rainCapacityFactors,
  indexFullScaleRatio: modelConfig.indexFullScaleRatio,
  baseServiceMinutes: modelConfig.baseServiceMinutes,
  bands: modelConfig.bands,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function speedRatio(current?: number, freeFlow?: number): number | null {
  if (current == null || freeFlow == null || freeFlow <= 0) return null;
  return clamp(current / freeFlow, 0, 1);
}

export function roadCapacityFactor(ratio: number | null, floor: number): number {
  if (ratio == null) return 1;
  return floor + (1 - floor) * ratio;
}

export function weatherCapacityFactor(rainMmPerHour: number, table: DemandPressureAssumptions['rainCapacityFactors']): number {
  const sorted = [...table].sort((a, b) => b.minMmPerHour - a.minMmPerHour);
  return sorted.find(r => rainMmPerHour >= r.minMmPerHour)?.factor ?? 1;
}

export function bandFor(index: number, bands: DemandPressureAssumptions['bands']): PressureBand {
  const sorted = [...bands].sort((a, b) => b.minIndex - a.minIndex);
  return (sorted.find(b => index >= b.minIndex)?.label ?? 'Low') as PressureBand;
}

export function computeDemandPressure(
  inputs: DemandPressureInputs,
  a: DemandPressureAssumptions = DEFAULT_ASSUMPTIONS,
): DemandPressureResult {
  const pickupVehicles = a.passengersPerVehicle > 0 ? (inputs.arrivingPassengers * a.pickupShare) / a.passengersPerVehicle : 0;
  const projectedVehicleDemand = pickupVehicles + inputs.departingDropoffVehicles;
  const ratio = speedRatio(inputs.roadCurrentSpeedKmh, inputs.roadFreeFlowSpeedKmh);
  const roadF = roadCapacityFactor(ratio, a.roadCapacityFloor);
  const weatherF = weatherCapacityFactor(inputs.rainfallMmPerHour, a.rainCapacityFactors);
  const effectiveCapacityVehicles = Math.max(0, a.baselineVehiclesPerHour * (a.windowMinutes / 60) * roadF * weatherF);

  let pressureRatio: number;
  if (effectiveCapacityVehicles > 0) pressureRatio = projectedVehicleDemand / effectiveCapacityVehicles;
  else pressureRatio = projectedVehicleDemand > 0 ? Number.POSITIVE_INFINITY : 0;

  const index = Number.isFinite(pressureRatio)
    ? Math.round(clamp((pressureRatio / a.indexFullScaleRatio) * 100, 0, 100))
    : 100;
  const excessVehicles = Number.isFinite(pressureRatio) ? Math.max(0, projectedVehicleDemand - effectiveCapacityVehicles) : projectedVehicleDemand;
  const dispatchDelayMinutes = effectiveCapacityVehicles > 0
    ? a.baseServiceMinutes + excessVehicles / (effectiveCapacityVehicles / a.windowMinutes)
    : null;

  return {
    pickupVehicles,
    projectedVehicleDemand,
    speedRatio: ratio,
    roadCapacityFactor: roadF,
    weatherCapacityFactor: weatherF,
    effectiveCapacityVehicles,
    pressureRatio,
    index,
    band: bandFor(index, a.bands),
    excessVehicles,
    dispatchDelayMinutes,
  };
}

/** Lowest rainfall in the most severe configured rain band — the UI's "heavy rain" cue. */
export function heavyRainThreshold(a: DemandPressureAssumptions): number {
  return Math.max(...a.rainCapacityFactors.map(r => r.minMmPerHour));
}

/** e.g. "Low <30, Moderate 30–59, High 60–79, Severe ≥80", from the configured bands. */
export function describeBands(a: DemandPressureAssumptions): string {
  const sorted = [...a.bands].sort((x, y) => x.minIndex - y.minIndex);
  return sorted.map((b, i) => {
    const next = sorted[i + 1];
    if (i === 0) return next ? `${b.label} <${next.minIndex}` : b.label;
    return next ? `${b.label} ${b.minIndex}–${next.minIndex - 1}` : `${b.label} ≥${b.minIndex}`;
  }).join(', ');
}

/** Assumptions rendered verbatim in the inspector and the alert (spec §6.1: "must be visible"). */
export function describeAssumptions(a: DemandPressureAssumptions): string[] {
  const rain = [...a.rainCapacityFactors].sort((x, y) => x.minMmPerHour - y.minMmPerHour)
    .map(r => `≥${r.minMmPerHour} mm/h → ×${r.factor}`).join(', ');
  return [
    `Time window: ${a.windowMinutes} min`,
    `Share of arriving passengers needing kerbside pickup: ${Math.round(a.pickupShare * 100)}%`,
    `Passengers per pickup vehicle: ${a.passengersPerVehicle}`,
    `Baseline forecourt processing capacity: ${a.baselineVehiclesPerHour} vehicles/h`,
    `Road capacity factor = ${a.roadCapacityFloor} + ${(1 - a.roadCapacityFloor).toFixed(2)} × speed ratio (floor models alternate approaches)`,
    `Rainfall capacity factor: ${rain}`,
    `Index = pressure ratio ÷ ${a.indexFullScaleRatio} × 100, capped at 100`,
    `Dispatch delay = ${a.baseServiceMinutes} min base service + excess vehicles ÷ capacity per minute (illustrative rule)`,
  ];
}
