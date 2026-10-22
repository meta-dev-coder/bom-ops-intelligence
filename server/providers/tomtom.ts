/**
 * TomTom Traffic Flow (flowSegmentData) for one configured road segment. TomTom snaps the query
 * point to the nearest road it knows — near Sahar that can be the surface road under the elevated
 * section — so the response is only accepted when TomTom's segment lies within a distance
 * threshold of our segment geometry ("proximity is not identity", learned in acs-demo).
 */
import type { RoadStatus, TrafficSegment } from '../../src/types/telemetry';

export interface SegmentGeometry { id: string; name: string; coordinates: number[][]; lengthM: number }

const M_PER_DEG_LAT = 110_540;
function toXY([lon, lat]: number[], lat0: number) {
  return [lon * 111_320 * Math.cos((lat0 * Math.PI) / 180), lat * M_PER_DEG_LAT];
}
export function distanceToPolylineM(p: number[], line: number[][]): number {
  return projectOntoPolyline(p, line).distanceM;
}

/** Nearest point on the polyline; `interior` is false when that point is one of the polyline's two ends. */
export function projectOntoPolyline(p: number[], line: number[][]): { distanceM: number; interior: boolean } {
  const lat0 = p[1];
  const [px, py] = toXY(p, lat0);
  let best = Infinity;
  let interior = false;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = toXY(line[i], lat0); const [bx, by] = toXY(line[i + 1], lat0);
    const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < best) {
      best = d;
      interior = !((i === 0 && t === 0) || (i === line.length - 2 && t === 1));
    }
  }
  return { distanceM: best, interior };
}

export function midpoint(line: number[][]): number[] {
  return line[Math.floor(line.length / 2)];
}

export function statusFor(speedRatio: number, table: { minRatio: number; status: string }[], closed: boolean): RoadStatus {
  if (closed) return 'BLOCKED';
  const sorted = [...table].sort((a, b) => b.minRatio - a.minRatio);
  return (sorted.find(r => speedRatio >= r.minRatio)?.status ?? 'BLOCKED') as RoadStatus;
}

export function parseTomTom(body: any, seg: SegmentGeometry, opts: { maxMatchDistanceM: number; statusTable: { minRatio: number; status: string }[]; nowIso: string }) {
  const f = body?.flowSegmentData;
  if (!f || typeof f.currentSpeed !== 'number' || typeof f.freeFlowSpeed !== 'number') throw new Error('TOMTOM_SCHEMA');
  const pts: number[][] = (f.coordinates?.coordinate ?? []).map((c: any) => [c.longitude, c.latitude]);
  // TomTom's segment often runs past our ends; only its points alongside our segment say whether it is the same road.
  const dists = pts.map(p => projectOntoPolyline(p, seg.coordinates)).filter(r => r.interior).map(r => r.distanceM).sort((a, b) => a - b);
  const matchM = dists.length >= 2 ? dists[Math.floor(dists.length / 2)] : Infinity;
  if (!(matchM <= opts.maxMatchDistanceM)) throw new Error(`SEGMENT_MISMATCH_${Math.round(matchM)}M`);
  const ratio = f.freeFlowSpeed > 0 ? f.currentSpeed / f.freeFlowSpeed : 0;
  const data: TrafficSegment = {
    id: seg.id, name: seg.name, currentSpeedKmh: f.currentSpeed, freeFlowSpeedKmh: f.freeFlowSpeed,
    status: statusFor(ratio, opts.statusTable, Boolean(f.roadClosure)), lengthM: seg.lengthM,
  };
  return {
    data,
    // flowSegmentData carries no timestamp; it is "current" at fetch time.
    observedAt: opts.nowIso,
    quality: `TomTom ${f.frc ?? ''} segment, median match ${Math.round(matchM)} m, confidence ${f.confidence ?? 'n/a'}`,
  };
}

export function createTomTomFetcher(opts: { apiKey: string; seg: SegmentGeometry; maxMatchDistanceM: number; statusTable: { minRatio: number; status: string }[]; fetchImpl?: typeof fetch; now?: () => number }) {
  const f = opts.fetchImpl ?? fetch;
  const [lon, lat] = midpoint(opts.seg.coordinates);
  return async (signal: AbortSignal) => {
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/12/json?point=${lat},${lon}&unit=KMPH&key=${encodeURIComponent(opts.apiKey)}`;
    const res = await f(url, { signal });
    if (!res.ok) throw new Error(`TOMTOM_HTTP_${res.status}`);
    return parseTomTom(await res.json(), opts.seg, { maxMatchDistanceM: opts.maxMatchDistanceM, statusTable: opts.statusTable, nowIso: new Date((opts.now ?? Date.now)()).toISOString() });
  };
}
