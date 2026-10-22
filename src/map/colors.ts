/** Map colour tokens shared by the Cesium layers and the React legend/cards (no Cesium import). */
import type { EntityType } from '../types/entities';
import type { RoadStatus } from '../types/telemetry';

export const ROAD_COLORS: Record<RoadStatus, string> = {
  FREE_FLOW: '#22c55e', MODERATE: '#eab308', HEAVY: '#f97316', SEVERE: '#ef4444', BLOCKED: '#dc2626',
};
export const TYPE_COLORS: Record<EntityType, string> = {
  TERMINAL: '#22d3ee', RUNWAY: '#e2e8f0', PARKING: '#a78bfa', FACILITY: '#2dd4bf', ROAD: '#94a3b8',
};
export const HAZARD_COLOR = '#ef4444';
