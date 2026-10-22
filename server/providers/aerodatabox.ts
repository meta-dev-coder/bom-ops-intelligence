/**
 * Real BOM arrivals (FIDS) from AeroDataBox, via RapidAPI or API.market. Needs a key with a plan
 * that permits commercial use (free/trial tiers do not). Schedules carry no passenger counts, so
 * passengers are ESTIMATED from aircraft category × assumed seats × load factor.
 */
import type { AircraftCategory, FlightRecord } from '../../src/types/telemetry';

export interface FlightAssumptions { seatsByCategory: Record<AircraftCategory, number>; loadFactor: number }

export function categoryFor(model?: string): AircraftCategory {
  const m = (model ?? '').toUpperCase();
  if (/A3[3-5]\d|A380|\b7[4-8]7\b|7[4-8]7-|BOEING 7[4-8]7|777|787|747|767|A350|A330/.test(m)) return 'WIDEBODY';
  if (/ATR|DASH|Q400|DHC|EMBRAER 1[79]\d|E1[79]\d|ERJ|CRJ|E-?JET|SAAB|DORNIER/.test(m)) return 'REGIONAL';
  return 'NARROWBODY';
}

export function terminalFor(t?: string): string {
  const s = (t ?? '').trim().toUpperCase();
  if (s.startsWith('2')) return 'terminal-t2';
  if (s.startsWith('1')) return 'terminal-t1';
  return 'terminal-unassigned';
}

const iso = (t?: { utc?: string }) => (t?.utc ? new Date(t.utc.replace(' ', 'T')).toISOString() : undefined);

export function parseAeroDataBox(body: any, opts: { now: number; assumptions: FlightAssumptions; horizonMinutes: number }): { data: FlightRecord[]; observedAt: string; quality: string } {
  if (!body || !Array.isArray(body.arrivals)) throw new Error('AERODATABOX_SCHEMA');
  const data: FlightRecord[] = [];
  for (const f of body.arrivals) {
    if (/cancel/i.test(f.status ?? '')) continue;
    const mv = f.movement ?? {};
    const scheduledAt = iso(mv.scheduledTime);
    const expectedAt = iso(mv.revisedTime) ?? iso(mv.predictedTime) ?? scheduledAt;
    if (!expectedAt) continue;
    const etaOffsetMinutes = Math.round((Date.parse(expectedAt) - opts.now) / 60_000);
    if (etaOffsetMinutes < -15 || etaOffsetMinutes > opts.horizonMinutes) continue;
    const category = categoryFor(f.aircraft?.model);
    data.push({
      id: `${f.number}-${scheduledAt}`,
      flightNumber: String(f.number ?? '—'),
      origin: mv.airport?.iata ?? mv.airport?.icao ?? undefined,
      terminalId: terminalFor(mv.terminal),
      aircraftCategory: category,
      etaOffsetMinutes,
      seatsAssumed: opts.assumptions.seatsByCategory[category],
      loadFactorAssumed: opts.assumptions.loadFactor,
      status: f.status,
      aircraftModel: f.aircraft?.model,
      scheduledAt,
      expectedAt,
    });
  }
  data.sort((a, b) => a.etaOffsetMinutes - b.etaOffsetMinutes);
  return {
    data,
    observedAt: new Date(opts.now).toISOString(),
    quality: `AeroDataBox FIDS — ${data.length} arrivals in the next ${opts.horizonMinutes} min; passengers estimated (seats by category × ${opts.assumptions.loadFactor})`,
  };
}

/** Local (IST) "YYYY-MM-DDTHH:mm" for the AeroDataBox window. */
export function istLocal(ms: number): string {
  return new Date(ms + 5.5 * 3600_000).toISOString().slice(0, 16);
}

/** `direct` = an AeroDataBox direct subscription: base URL and key header come from your AeroDataBox dashboard. */
export interface AeroDataBoxDirect { baseUrl: string; keyHeader: string }

export function createAeroDataBoxFetcher(opts: { apiKey: string; via: 'rapidapi' | 'apimarket' | 'direct'; direct?: AeroDataBoxDirect; assumptions: FlightAssumptions; horizonMinutes: number; fetchImpl?: typeof fetch; now?: () => number }) {
  const f = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  return async (signal: AbortSignal) => {
    const t = now();
    const path = `flights/airports/icao/VABB/${istLocal(t - 15 * 60_000)}/${istLocal(t + opts.horizonMinutes * 60_000)}?direction=Arrival&withLeg=false&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false`;
    const [url, headers]: [string, Record<string, string>] =
      opts.via === 'direct' && opts.direct
        ? [`${opts.direct.baseUrl.replace(/\/+$/, '')}/${path}`, { [opts.direct.keyHeader]: opts.apiKey }]
        : opts.via === 'apimarket'
          ? [`https://prod.api.market/api/v1/aedbx/aerodatabox/${path}`, { 'x-magicapi-key': opts.apiKey }]
          : [`https://aerodatabox.p.rapidapi.com/${path}`, { 'X-RapidAPI-Key': opts.apiKey, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' }];
    const res = await f(url, { signal, headers });
    if (!res.ok) throw new Error(`AERODATABOX_HTTP_${res.status}`);
    return parseAeroDataBox(await res.json(), { now: t, assumptions: opts.assumptions, horizonMinutes: opts.horizonMinutes });
  };
}
