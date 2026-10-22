/**
 * Live ADS-B positions around BOM from adsb.lol — no key, data under ODbL 1.0 (attribution
 * required). Coverage over Mumbai is community-fed and incomplete; positions older than
 * `maxPositionAgeS` are dropped rather than shown as current.
 */
import type { LiveAircraft } from '../../src/types/telemetry';

export const ADSB_URL = (lat: number, lon: number, radiusNm: number) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${radiusNm}`;

export function parseAdsbLol(body: any, opts: { maxPositionAgeS: number; nowIso: string }): { data: LiveAircraft[]; observedAt: string; quality: string } {
  if (!body || !Array.isArray(body.ac)) throw new Error('ADSB_SCHEMA');
  const data: LiveAircraft[] = [];
  for (const a of body.ac) {
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number' || typeof a.hex !== 'string') continue;
    const age = typeof a.seen_pos === 'number' ? a.seen_pos : typeof a.seen === 'number' ? a.seen : Infinity;
    if (!(age <= opts.maxPositionAgeS)) continue;
    const onGround = a.alt_baro === 'ground';
    data.push({
      hex: a.hex,
      callsign: typeof a.flight === 'string' && a.flight.trim() ? a.flight.trim() : undefined,
      registration: typeof a.r === 'string' ? a.r : undefined,
      typeCode: typeof a.t === 'string' ? a.t : undefined,
      lat: a.lat, lon: a.lon,
      altitudeFt: onGround ? 0 : typeof a.alt_baro === 'number' ? a.alt_baro : typeof a.alt_geom === 'number' ? a.alt_geom : 0,
      onGround,
      groundSpeedKt: typeof a.gs === 'number' ? a.gs : undefined,
      trackDeg: typeof a.track === 'number' ? a.track : typeof a.true_heading === 'number' ? a.true_heading : undefined,
      positionAgeS: age,
    });
  }
  const observedAt = typeof body.now === 'number' ? new Date(body.now).toISOString() : opts.nowIso;
  return { data, observedAt, quality: `adsb.lol community ADS-B (ODbL) — ${data.length} aircraft with a position ≤ ${opts.maxPositionAgeS}s old; coverage incomplete` };
}

export function createAdsbFetcher(opts: { lat: number; lon: number; radiusNm: number; maxPositionAgeS: number; fetchImpl?: typeof fetch; now?: () => number }) {
  const f = opts.fetchImpl ?? fetch;
  return async (signal: AbortSignal) => {
    const res = await f(ADSB_URL(opts.lat, opts.lon, opts.radiusNm), { signal, headers: { 'User-Agent': 'bom-ops-intelligence-poc' } });
    if (!res.ok) throw new Error(`ADSB_HTTP_${res.status}`);
    return parseAdsbLol(await res.json(), { maxPositionAgeS: opts.maxPositionAgeS, nowIso: new Date((opts.now ?? Date.now)()).toISOString() });
  };
}
