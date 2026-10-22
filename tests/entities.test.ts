import { describe, expect, it } from 'vitest';
import { ENTITIES } from '../src/map/EntityRegistry';
import { BASELINE_FIXTURE, SCENARIO_MONSOON } from '../src/data/MockDataService';

const inBom = ([lon, lat]: number[]) => lon > 72.83 && lon < 72.9 && lat > 19.07 && lat < 19.12;

describe('entity registry geometry (spec §5.3)', () => {
  it('has T1, T2, a road, a runway, parking and a generic facility', () => {
    const types = new Set(ENTITIES.map(e => e.type));
    for (const t of ['TERMINAL', 'ROAD', 'RUNWAY', 'PARKING', 'FACILITY']) expect(types.has(t as any)).toBe(true);
    for (const id of ['terminal-t1', 'terminal-t2']) expect(ENTITIES.find(e => e.id === id)).toBeTruthy();
  });

  it('stores WGS84 [lon, lat] in the right order, inside the BOM area', () => {
    for (const e of ENTITIES) {
      const pts = e.geometry.type === 'Polygon' ? e.geometry.coordinates[0] : e.geometry.coordinates;
      expect(pts.length).toBeGreaterThan(1);
      expect(pts.every(inBom), e.id).toBe(true);
    }
  });

  it('closes every polygon ring and records provenance and review status', () => {
    for (const e of ENTITIES) {
      if (e.geometry.type === 'Polygon') expect(e.geometry.coordinates[0][0]).toEqual(e.geometry.coordinates[0].at(-1));
      expect(e.geometrySource).toBeTruthy();
      expect(e.reviewStatus).toMatch(/UNREVIEWED/);
    }
  });

  it('every id referenced by fixtures and the scenario exists in the registry', () => {
    const ids = new Set(ENTITIES.map(e => e.id));
    const refs = [
      ...BASELINE_FIXTURE.traffic.map(t => t.id), ...Object.keys(BASELINE_FIXTURE.terminals),
      ...Object.keys(BASELINE_FIXTURE.parking), ...Object.keys(BASELINE_FIXTURE.facilities),
      SCENARIO_MONSOON.targetEntityId, SCENARIO_MONSOON.roadEntityId,
    ];
    for (const r of refs) expect(ids.has(r), r).toBe(true);
  });
});
