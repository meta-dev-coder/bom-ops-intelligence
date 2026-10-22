import { describe, expect, it } from 'vitest';
import { createProviderService, redact } from '../server/providerService';
import { parseOpenMeteo } from '../server/providers/openMeteo';
import { parseTomTom, statusFor } from '../server/providers/tomtom';
import model from '../src/config/model.json';
import { BASELINE_FIXTURE } from '../src/data/MockDataService';

const quiet = { warn: () => {} };
const noSleep = async () => {};

describe('provider service cache/fallback (FR-10)', () => {
  it('LIVE on success, STALE with last value on later failure, never LIVE after failure', async () => {
    let t = Date.parse('2026-10-21T13:00:00Z'); let fail = false; let calls = 0;
    const svc = createProviderService({
      providerId: 'x', label: 'X', enabled: true, refreshSeconds: 60, staleAfterSeconds: 600, timeoutMs: 1000, retries: 0,
      now: () => t, sleep: noSleep, log: quiet,
      fetcher: async () => { calls++; if (fail) throw new Error('boom key=SECRET123'); return { data: { v: 1 }, observedAt: new Date(t).toISOString(), quality: 'q' }; },
    });
    const a = await svc.get();
    expect('envelope' in a && a.envelope.state).toBe('LIVE');
    fail = true; t += 61_000;
    const b = await svc.get();
    expect('envelope' in b && b.envelope.state).toBe('STALE');
    expect('envelope' in b && b.envelope.data).toEqual({ v: 1 });
    expect(svc.health().error).not.toContain('SECRET123');
    expect(calls).toBe(2);
  });

  it('does not refetch inside the refresh interval, and de-duplicates concurrent calls', async () => {
    let calls = 0; const t = 0;
    const svc = createProviderService({
      providerId: 'x', label: 'X', enabled: true, refreshSeconds: 60, staleAfterSeconds: 600, timeoutMs: 1000,
      now: () => t, sleep: noSleep, log: quiet,
      fetcher: async () => { calls++; return { data: 1, observedAt: new Date(t).toISOString(), quality: '' }; },
    });
    await Promise.all([svc.get(), svc.get(), svc.get()]);
    await svc.get();
    expect(calls).toBe(1);
  });

  it('reports 503 UNAVAILABLE with no cache, and DISABLED providers are never called', async () => {
    let called = false;
    const off = createProviderService({ providerId: 'x', label: 'X', enabled: false, refreshSeconds: 1, staleAfterSeconds: 1, timeoutMs: 1, fetcher: async () => { called = true; return { data: 1, observedAt: '', quality: '' }; } });
    expect(await off.get()).toMatchObject({ status: 503 });
    expect(called).toBe(false);
    const down = createProviderService({ providerId: 'y', label: 'Y', enabled: true, refreshSeconds: 1, staleAfterSeconds: 1, timeoutMs: 1000, retries: 1, sleep: noSleep, log: quiet, fetcher: async () => { throw new Error('down'); } });
    expect(await down.get()).toMatchObject({ status: 503, error: 'down' });
    expect(down.health().state).toBe('UNAVAILABLE');
  });

  it('redacts credentials from messages', () => {
    expect(redact('GET https://a/b?point=1&key=abc123&x=1')).toBe('GET https://a/b?point=1&key=***&x=1');
    expect(redact('Authorization: Bearer eyJabc.def')).toBe('Authorization: Bearer ***');
  });
});

describe('Open-Meteo adapter', () => {
  it('maps current conditions, converts 15-min precipitation to mm/h, labels as model data', () => {
    const r = parseOpenMeteo({ latitude: 19.086, longitude: 72.853, utc_offset_seconds: 19800,
      current: { time: '2026-10-21T20:30', interval: 900, temperature_2m: 27.4, precipitation: 0.5, weather_code: 63, wind_speed_10m: 12.1, wind_direction_10m: 250 } });
    expect(r.data).toMatchObject({ temperatureC: 27.4, precipitationMmPerHour: 2, condition: 'Rain', kind: 'MODEL' });
    expect(r.observedAt).toBe('2026-10-21T20:30:00+05:30');
    expect(r.quality).toMatch(/not a station observation/);
  });
  it('rejects a malformed body', () => {
    expect(() => parseOpenMeteo({ current: {} })).toThrow('OPEN_METEO_SCHEMA');
  });
});

describe('TomTom adapter', () => {
  const seg = { id: 's', name: 'S', lengthM: 1000, coordinates: [[72.862, 19.1023], [72.8718, 19.1032]] };
  const body = (coords: number[][], extra = {}) => ({ flowSegmentData: { frc: 'FRC2', currentSpeed: 20, freeFlowSpeed: 45, confidence: 0.9, roadClosure: false, coordinates: { coordinate: coords.map(([lo, la]) => ({ longitude: lo, latitude: la })) }, ...extra } });
  const opts = { maxMatchDistanceM: 40, statusTable: model.roadStatusBySpeedRatio, nowIso: '2026-10-21T15:00:00Z' };

  it('accepts a segment that lies on our geometry', () => {
    const r = parseTomTom(body([[72.863, 19.10239], [72.87, 19.10303]]), seg, opts);
    expect(r.data).toMatchObject({ currentSpeedKmh: 20, freeFlowSpeedKmh: 45, status: 'HEAVY' });
  });
  it('rejects a snapped segment on a different road (> 40 m away)', () => {
    expect(() => parseTomTom(body([[72.863, 19.1010], [72.87, 19.1016]]), seg, opts)).toThrow(/SEGMENT_MISMATCH/);
  });
  it('maps roadClosure to BLOCKED regardless of speed', () => {
    expect(statusFor(0.9, model.roadStatusBySpeedRatio, true)).toBe('BLOCKED');
  });
});

describe('review regressions', () => {
  it('health() reports STALE once data ages past its threshold, matching get()', async () => {
    let t = Date.parse('2026-10-21T13:00:00Z');
    const svc = createProviderService({
      providerId: 'x', label: 'X', enabled: true, refreshSeconds: 3600, staleAfterSeconds: 600, timeoutMs: 1000,
      now: () => t, sleep: noSleep, log: quiet,
      fetcher: async () => ({ data: 1, observedAt: new Date(t).toISOString(), quality: '' }),
    });
    await svc.get();
    expect(svc.health().state).toBe('LIVE');
    t += 601_000;
    expect(svc.health().state).toBe('STALE');
    const r = await svc.get();
    expect('envelope' in r && r.envelope.state).toBe('STALE');
  });

  it('Open-Meteo without current.time is a schema error, not LIVE forever', () => {
    expect(() => parseOpenMeteo({ current: { temperature_2m: 27, precipitation: 0, weather_code: 0, wind_speed_10m: 5, wind_direction_10m: 90 } })).toThrow('OPEN_METEO_SCHEMA');
  });

  it('TomTom: a longer segment on the same road matches; points beyond our ends are ignored', () => {
    const seg = { id: 's', name: 'S', lengthM: 1000, coordinates: [[72.862, 19.1023], [72.8718, 19.1032]] };
    const onRoad = (lon: number) => [lon, 19.1023 + ((lon - 72.862) / (72.8718 - 72.862)) * 0.0009];
    const coords = [72.85, 72.852, 72.854, 72.856, 72.858, 72.865, 72.868, 72.88, 72.885, 72.89].map(onRoad);
    const body = { flowSegmentData: { currentSpeed: 30, freeFlowSpeed: 45, coordinates: { coordinate: coords.map(([lo, la]) => ({ longitude: lo, latitude: la })) } } };
    const r = parseTomTom(body, seg, { maxMatchDistanceM: 40, statusTable: model.roadStatusBySpeedRatio, nowIso: '2026-10-21T15:00:00Z' });
    expect(r.data.currentSpeedKmh).toBe(30);
  });
});

describe('/api handler under a sub-path base', () => {
  it('serves /poc/api/health and still passes non-api paths through', async () => {
    const { createApi } = await import('../server/apiPlugin');
    const handle = createApi({}, process.cwd(), '/poc/');
    const call = (url: string) => new Promise<{ status: number; body?: any; next: boolean }>(resolve => {
      const res: any = { headers: {}, setHeader() {}, end(b: string) { resolve({ status: res.statusCode, body: JSON.parse(b), next: false }); } };
      void handle({ url, method: 'GET' } as any, res, () => resolve({ status: 0, next: true }));
    });
    const h = await call('/poc/api/health');
    expect(h.status).toBe(200);
    expect(h.body.providers.length).toBe(3 + BASELINE_FIXTURE.traffic.length); // weather, aircraft, flights + one per road
    expect((await call('/poc/index.html')).next).toBe(true);
  });
});
