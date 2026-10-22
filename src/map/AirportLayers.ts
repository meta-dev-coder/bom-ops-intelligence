/**
 * Selectable airport entities (spec §5.1): terminals, runways, parking and facilities as fills
 * draped onto terrain AND the 3D buildings (so selecting T2 tints the real building), with
 * ground-polyline outlines — clamped polygon outlines render at 1 px (acs-demo c3ed437).
 * Roads are ground polylines over a dark casing, coloured by status.
 */
import {
  CallbackProperty, Cartesian2, Cartesian3, ClassificationType, Color, ColorMaterialProperty, ConstantProperty,
  CustomDataSource, DistanceDisplayCondition, Entity, HeightReference, JulianDate, LabelStyle,
  PolygonHierarchy, VerticalOrigin, type Viewer,
} from 'cesium';
import type { AirportEntity, EntityType } from '../types/entities';
import type { RoadStatus } from '../types/telemetry';
import { ENTITIES } from './EntityRegistry';

export const ROAD_COLORS: Record<RoadStatus, string> = {
  FREE_FLOW: '#22c55e', MODERATE: '#eab308', HEAVY: '#f97316', SEVERE: '#ef4444', BLOCKED: '#dc2626',
};
export const TYPE_COLORS: Record<EntityType, string> = {
  TERMINAL: '#22d3ee', RUNWAY: '#e2e8f0', PARKING: '#a78bfa', FACILITY: '#2dd4bf', ROAD: '#94a3b8',
};
const SELECTED = Color.fromCssColorString('#f8fafc');
const PULSE = Color.fromCssColorString('#f59e0b');

export interface StyleInput {
  selectedId: string | null;
  hoveredId: string | null;
  roadStatus: Record<string, RoadStatus>;
  pulseId: string | null;
  reducedMotion: boolean;
  visible: { roads: boolean; facilities: boolean; runways: boolean };
}

interface Parts { def: AirportEntity; fill?: Entity; outline: Entity; casing?: Entity; label: Entity }

const toPositions = (coords: number[][]) => coords.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat));

function centroid(def: AirportEntity): number[] {
  const pts = def.geometry.type === 'Polygon' ? def.geometry.coordinates[0].slice(0, -1) : def.geometry.coordinates;
  if (def.geometry.type === 'LineString') return pts[Math.floor(pts.length / 2)];
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

export function installAirportLayers(viewer: Viewer) {
  const ds = new CustomDataSource('airport-entities');
  void viewer.dataSources.add(ds);
  /** Cesium entity → registry id, for the central picker. */
  const pickIds = new Map<Entity, string>();
  const parts = new Map<string, Parts>();
  /** Current non-pulsing fill per terminal, read by the terminals' CallbackProperty. */
  const terminalFill = new Map<string, Color>();
  let pulseOn = false;
  let reducedMotion = false;
  let s0: Pick<StyleInput, 'pulseId'> = { pulseId: null };

  for (const def of ENTITIES) {
    const base = Color.fromCssColorString(TYPE_COLORS[def.type]);
    const p: Partial<Parts> = { def };
    if (def.geometry.type === 'Polygon') {
      const ring = def.geometry.coordinates[0];
      const isPulseTarget = def.type === 'TERMINAL';
      const fillColor = isPulseTarget
        ? new CallbackProperty((time?: JulianDate) => {
            if (!pulseOn || s0.pulseId !== def.id) return terminalFill.get(def.id) ?? base.withAlpha(0.28);
            if (reducedMotion || !time) return PULSE.withAlpha(0.55);
            const phase = (JulianDate.toDate(time).getTime() / 1000) % 1.6;
            return PULSE.withAlpha(0.3 + 0.35 * Math.abs(Math.sin((phase / 1.6) * Math.PI)));
          }, false)
        : base.withAlpha(0.28);
      p.fill = ds.entities.add({
        id: `${def.id}:fill`,
        polygon: {
          hierarchy: new PolygonHierarchy(toPositions(ring)),
          material: new ColorMaterialProperty(fillColor as any),
          classificationType: ClassificationType.BOTH,
        },
      });
      p.outline = ds.entities.add({
        id: `${def.id}:outline`,
        polyline: { positions: toPositions(ring), clampToGround: true, width: 2, material: base.withAlpha(0.9) },
      });
    } else {
      const coords = def.geometry.coordinates;
      p.casing = ds.entities.add({
        id: `${def.id}:casing`,
        polyline: { positions: toPositions(coords), clampToGround: true, width: 12, material: Color.fromCssColorString('#020617').withAlpha(0.75) },
      });
      p.outline = ds.entities.add({
        id: `${def.id}:line`,
        polyline: { positions: toPositions(coords), clampToGround: true, width: 7, material: Color.fromCssColorString(ROAD_COLORS.MODERATE) },
      });
    }
    const [lon, lat] = centroid(def);
    p.label = ds.entities.add({
      id: `${def.id}:label`,
      position: Cartesian3.fromDegrees(lon, lat),
      label: {
        text: def.name, font: '600 13px Inter, system-ui, sans-serif',
        fillColor: Color.WHITE, outlineColor: Color.fromCssColorString('#020617'), outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE, verticalOrigin: VerticalOrigin.BOTTOM, pixelOffset: new Cartesian2(0, -8),
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new DistanceDisplayCondition(0, def.type === 'TERMINAL' ? 14_000 : 7_000),
        showBackground: true, backgroundColor: Color.fromCssColorString('#0f172a').withAlpha(0.7),
        backgroundPadding: new Cartesian2(6, 3),
      },
    });
    for (const e of [p.fill, p.outline, p.casing, p.label]) if (e) pickIds.set(e, def.id);
    parts.set(def.id, p as Parts);
  }

  /** One material per colour, reused, so restyling never swaps materials needlessly. */
  const materials = new Map<string, ColorMaterialProperty>();
  const material = (c: Color) => {
    const key = c.toCssColorString();
    let m = materials.get(key);
    if (!m) materials.set(key, (m = new ColorMaterialProperty(c)));
    return m;
  };
  /** Last applied style per entity: only entities whose style actually changed are touched. */
  const applied = new Map<string, string>();

  function applyStyle(s: StyleInput) {
    pulseOn = Boolean(s.pulseId);
    s0 = s;
    reducedMotion = s.reducedMotion;
    let changed = false;
    for (const [id, p] of parts) {
      const { def } = p;
      const layerVisible = def.type === 'ROAD' ? s.visible.roads : def.type === 'RUNWAY' ? s.visible.runways : s.visible.facilities;
      const selected = s.selectedId === id;
      const hovered = s.hoveredId === id;
      const pulsing = s.pulseId === id;
      const status = def.type === 'ROAD' ? s.roadStatus[id] ?? 'MODERATE' : '';
      const key = `${layerVisible}|${selected}|${hovered}|${pulsing}|${status}`;
      if (applied.get(id) === key) continue;
      applied.set(id, key);
      changed = true;
      for (const e of [p.fill, p.outline, p.casing, p.label]) if (e) e.show = layerVisible;
      if (def.type === 'ROAD') {
        p.outline.polyline!.material = material(Color.fromCssColorString(ROAD_COLORS[status as RoadStatus]));
        p.outline.polyline!.width = new ConstantProperty(selected ? 10 : hovered ? 9 : 7);
        p.casing!.polyline!.material = material((selected ? SELECTED : Color.fromCssColorString('#020617')).withAlpha(selected ? 0.95 : 0.75));
        p.casing!.polyline!.width = new ConstantProperty(selected ? 16 : 12);
      } else {
        const base = Color.fromCssColorString(TYPE_COLORS[def.type]);
        const alpha = selected ? 0.45 : hovered ? 0.38 : def.type === 'RUNWAY' ? 0.14 : 0.26;
        if (p.fill) {
          // Terminal fills are a CallbackProperty (for the pulse) that reads this map — no material swap.
          if (def.type === 'TERMINAL') terminalFill.set(id, base.withAlpha(alpha));
          else p.fill.polygon!.material = material(base.withAlpha(alpha));
        }
        p.outline.polyline!.material = material(selected ? SELECTED : pulsing ? PULSE : base.withAlpha(hovered ? 1 : 0.85));
        p.outline.polyline!.width = new ConstantProperty(selected ? 4 : hovered || pulsing ? 3 : 2);
      }
    }
    if (changed) viewer.scene.requestRender();
  }

  return {
    pickIds,
    entityFor: (id: string) => parts.get(id),
    applyStyle,
    destroy() { if (!viewer.isDestroyed()) viewer.dataSources.remove(ds, true); },
  };
}
