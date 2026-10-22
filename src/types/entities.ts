export type EntityType = 'TERMINAL' | 'ROAD' | 'RUNWAY' | 'PARKING' | 'FACILITY';

/** Spec §11.3 AirportEntity; geometry is GeoJSON WGS84 [lon, lat]. */
export interface AirportEntity {
  id: string;
  name: string;
  type: EntityType;
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'LineString'; coordinates: number[][] };
  geometrySource: string;
  geometryConfidence: 'low' | 'medium' | 'high';
  reviewStatus: string;
  properties: Record<string, unknown>;
  enabledKpis: string[];
  adjacentEntityIds: string[];
}
