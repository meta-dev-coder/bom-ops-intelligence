/**
 * Same-origin data proxy mounted inside `vite` dev and `vite preview` (acs-demo pattern), so the
 * browser never calls a provider directly and provider keys never reach the bundle.
 *   GET /api/weather              → { envelope } | { error }
 *   GET /api/traffic/:segmentId   → { envelope } | { error }
 *   GET /api/aircraft             → { envelope<LiveAircraft[]> } | { error }   (adsb.lol, no key)
 *   GET /api/flights              → { envelope<FlightRecord[]> } | { error }   (AeroDataBox, key)
 *   GET /api/health               → provider health (no secrets)
 * Weather is METAR VABB (aviationweather.gov, no key) unless OPEN_METEO_API_KEY is set.
 * API_ALLOWED_ORIGIN lets a static front end (e.g. GitHub Pages) call this proxy cross-origin.
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { createProviderService } from './providerService';
import { createAdsbFetcher } from './providers/adsbLol';
import { createAeroDataBoxFetcher } from './providers/aerodatabox';
import { createMetarFetcher } from './providers/metar';
import { createOpenMeteoFetcher } from './providers/openMeteo';
import { createTomTomFetcher, type SegmentGeometry } from './providers/tomtom';

export interface ApiEnv {
  TOMTOM_API_KEY?: string;
  OPEN_METEO_API_KEY?: string;
  AERODATABOX_API_KEY?: string;
  /** 'rapidapi' (default), 'apimarket' or 'direct' */
  AERODATABOX_VIA?: string;
  /** direct subscription only: API base URL and key header name from the AeroDataBox dashboard */
  AERODATABOX_BASE_URL?: string;
  AERODATABOX_KEY_HEADER?: string;
  /** Flight refresh in seconds (default 900; ~300 suits the $19 Starter plan). */
  AERODATABOX_REFRESH_SECONDS?: string;
  /** Exact origin allowed to call /api cross-origin, e.g. https://meta-dev-coder.github.io */
  API_ALLOWED_ORIGIN?: string;
}

const AIRPORT = { lat: 19.0896, lon: 72.8656 };
// Every road in the baseline fixture can be served live (TomTom) when a key is configured.
const liveSegments = (baseline: { traffic: { id: string }[] }) => baseline.traffic.map(t => t.id);

/** The three data files the proxy needs, as JSON text (from the source tree or a release's data/). */
export interface ApiFiles { entities: string; baseline: string; model: string }

export const sourceTreeFiles = (root: string): ApiFiles => ({
  entities: readFileSync(`${root}/src/data/fixtures/bom-entities.geojson`, 'utf8'),
  baseline: readFileSync(`${root}/src/data/fixtures/bom-baseline.json`, 'utf8'),
  model: readFileSync(`${root}/src/config/model.json`, 'utf8'),
});

export function createApi(env: ApiEnv, files: ApiFiles, base = '/') {
  const geo = JSON.parse(files.entities);
  const baseline = JSON.parse(files.baseline);
  const model = JSON.parse(files.model);
  const lengthById: Record<string, number> = Object.fromEntries(baseline.traffic.map((t: any) => [t.id, t.lengthM]));

  // METAR (keyless, public-domain US-government data) by default; a licensed Open-Meteo key overrides it.
  const weather = env.OPEN_METEO_API_KEY
    ? createProviderService({
        providerId: 'open-meteo', label: 'Weather — Open-Meteo (licensed)', enabled: true,
        refreshSeconds: 60, staleAfterSeconds: 30 * 60, timeoutMs: 8000,
        fetcher: createOpenMeteoFetcher({ ...AIRPORT, apiKey: env.OPEN_METEO_API_KEY }),
      })
    : createProviderService({
        providerId: 'metar', label: 'Weather — METAR VABB (aviationweather.gov)', enabled: true,
        // METARs are issued every 30 min and can reach the feed ~15 min late; poll every 5 min and
        // treat > 90 min (one missed report plus lag) as stale.
        refreshSeconds: 300, staleAfterSeconds: 90 * 60, timeoutMs: 8000,
        fetcher: createMetarFetcher(),
      });

  const aircraft = createProviderService({
    providerId: 'adsb-lol', label: 'Aircraft — adsb.lol (ODbL)', enabled: true,
    refreshSeconds: 15, staleAfterSeconds: 90, timeoutMs: 8000, retries: 0,
    fetcher: createAdsbFetcher({ ...AIRPORT, radiusNm: 40, maxPositionAgeS: 60 }),
  });

  const flights = createProviderService({
    providerId: 'aerodatabox', label: 'Flights — AeroDataBox', enabled: Boolean(env.AERODATABOX_API_KEY),
    disabledReason: 'Set AERODATABOX_API_KEY (server-side) to enable real arrivals',
    // Free/low tiers have small monthly quotas: refresh every 15 min.
    refreshSeconds: Math.max(120, Number(env.AERODATABOX_REFRESH_SECONDS) || 900), staleAfterSeconds: 45 * 60, timeoutMs: 10_000, retries: 0,
    fetcher: createAeroDataBoxFetcher({
      apiKey: env.AERODATABOX_API_KEY ?? '',
      via: env.AERODATABOX_VIA === 'apimarket' ? 'apimarket' : env.AERODATABOX_VIA === 'direct' ? 'direct' : 'rapidapi',
      direct: env.AERODATABOX_BASE_URL && env.AERODATABOX_KEY_HEADER ? { baseUrl: env.AERODATABOX_BASE_URL, keyHeader: env.AERODATABOX_KEY_HEADER } : undefined,
      assumptions: model.liveFlightAssumptions, horizonMinutes: 120,
    }),
  });

  const traffic = Object.fromEntries(liveSegments(baseline).map(id => {
    const f = geo.features.find((x: any) => x.id === id);
    const seg: SegmentGeometry = { id, name: f.properties.name, coordinates: f.geometry.coordinates, lengthM: lengthById[id] };
    return [id, createProviderService({
      providerId: `tomtom:${id}`, label: `Traffic — TomTom (${f.properties.name})`,
      enabled: Boolean(env.TOMTOM_API_KEY), disabledReason: 'Set TOMTOM_API_KEY (server-side) to enable',
      refreshSeconds: 60, staleAfterSeconds: 5 * 60, timeoutMs: 8000,
      fetcher: createTomTomFetcher({ apiKey: env.TOMTOM_API_KEY ?? '', seg, maxMatchDistanceM: 40, statusTable: model.roadStatusBySpeedRatio }),
    })];
  }));

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    if (env.API_ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', env.API_ALLOWED_ORIGIN);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };

  return async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = new URL(req.url ?? '/', 'http://local');
    // Plugin middlewares run before Vite strips `base`, so accept both /api/… and <base>api/….
    const path = base !== '/' && url.pathname.startsWith(base) ? `/${url.pathname.slice(base.length)}` : url.pathname;
    if (!path.startsWith('/api/')) return next();
    if (req.method !== 'GET') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    try {
      if (path === '/api/weather') {
        const r = await weather.get();
        return 'envelope' in r ? send(res, 200, r) : send(res, r.status, { error: r.error });
      }
      const m = path.match(/^\/api\/traffic\/([\w-]+)$/);
      if (m) {
        const svc = traffic[m[1]];
        if (!svc) return send(res, 404, { error: 'UNKNOWN_SEGMENT' });
        const r = await svc.get();
        return 'envelope' in r ? send(res, 200, r) : send(res, r.status, { error: r.error });
      }
      if (path === '/api/aircraft' || path === '/api/flights') {
        const r = await (path === '/api/aircraft' ? aircraft : flights).get();
        return 'envelope' in r ? send(res, 200, r) : send(res, r.status, { error: r.error });
      }
      if (path === '/api/health') {
        return send(res, 200, { providers: [weather.health(), aircraft.health(), flights.health(), ...Object.values(traffic).map(s => s.health())] });
      }
      return send(res, 404, { error: 'NOT_FOUND' });
    } catch {
      return send(res, 500, { error: 'INTERNAL' });
    }
  };
}

export function apiPlugin(env: ApiEnv): Plugin {
  let handler: ReturnType<typeof createApi>;
  return {
    name: 'bom-api',
    configResolved(cfg) { handler = createApi(env, sourceTreeFiles(cfg.root), cfg.base); },
    configureServer(server) { server.middlewares.use((req, res, next) => void handler(req, res, next)); },
    configurePreviewServer(server) { server.middlewares.use((req, res, next) => void handler(req, res, next)); },
  };
}
