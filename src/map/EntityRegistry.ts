/**
 * Asset registry (spec §5.1): stable ids, names, type, geometry provenance and KPI mapping.
 * Geometry lives in a separate GeoJSON layer so client GIS/CAD/BIM can replace it later.
 */
import geojson from '../data/fixtures/bom-entities.geojson?raw';
import type { AirportEntity, EntityType } from '../types/entities';

const KPIS_BY_TYPE: Record<EntityType, string[]> = {
  TERMINAL: ['passengerDemandIndex', 'arrivalDemand30', 'forecourtPressure', 'dispatchDelay', 'cabStaging', 'apronStands'],
  ROAD: ['currentSpeed', 'freeFlowSpeed', 'speedRatio', 'travelTimeRatio', 'incidentState'],
  RUNWAY: ['designator', 'scenarioStatus'],
  PARKING: ['occupancyProxy', 'availableCapacity'],
  FACILITY: ['facilityStatus'],
};

export const ENTITY_ATTRIBUTION: string = JSON.parse(geojson).attribution;

export function parseEntities(raw: string): AirportEntity[] {
  const fc = JSON.parse(raw) as { features: { id: string; properties: Record<string, any>; geometry: AirportEntity['geometry'] }[] };
  return fc.features.map(f => {
    const { id, name, type, geometrySource, geometryConfidence, reviewStatus, adjacentEntityIds, ...rest } = f.properties;
    return {
      id, name, type, geometry: f.geometry, geometrySource, geometryConfidence, reviewStatus,
      adjacentEntityIds: adjacentEntityIds ?? [],
      properties: rest,
      enabledKpis: KPIS_BY_TYPE[type as EntityType] ?? [],
    };
  });
}

export const ENTITIES: AirportEntity[] = parseEntities(geojson);
export const ENTITY_BY_ID: Record<string, AirportEntity> = Object.fromEntries(ENTITIES.map(e => [e.id, e]));
export const ENTITY_NAMES: Record<string, string> = Object.fromEntries(ENTITIES.map(e => [e.id, e.name]));
