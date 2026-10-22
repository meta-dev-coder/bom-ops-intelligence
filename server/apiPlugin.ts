/**
 * Same-origin data proxy mounted inside `vite` dev and `vite preview` (acs-demo pattern), so the
 * browser never calls a provider directly and provider keys never reach the bundle.
 *   GET /api/weather              → { envelope } | { error }
 *   GET /api/traffic/:segmentId   → { envelope } | { error }
 *   GET /api/health               → provider health (no secrets)
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { createProviderService } from './providerService';
import { createOpenMeteoFetcher } from './providers/openMeteo';
import { createTomTomFetcher, type SegmentGeometry } from './providers/tomtom';

export interface ApiEnv { TOMTOM_API_KEY?: string; OPEN_METEO_API_KEY?: string; OPEN_METEO_ALLOW_FREE?: string }

const AIRPORT = { lat: 19.0896, lon: 72.8656 };
const LIVE_SEGMENTS = ['road-sahar-inbound', 'road-sahar-outbound'];

export function createApi(env: ApiEnv, root: string, base = '/') {
  const geo = JSON.parse(readFileSync(`${root}/src/data/fixtures/bom-entities.geojson`, 'utf8'));
  const baseline = JSON.parse(readFileSync(`${root}/src/data/fixtures/bom-baseline.json`, 'utf8'));
  const model = JSON.parse(readFileSync(`${root}/src/config/model.json`, 'utf8'));
  const lengthById: Record<string, number> = Object.fromEntries(baseline.traffic.map((t: any) => [t.id, t.lengthM]));

  const meteoEnabled = Boolean(env.OPEN_METEO_API_KEY) || env.OPEN_METEO_ALLOW_FREE === 'true';
  const weather = createProviderService({
    providerId: 'open-meteo', label: env.OPEN_METEO_API_KEY ? 'Open-Meteo (licensed)' : 'Open-Meteo (free, non-commercial)',
    enabled: meteoEnabled,
    disabledReason: 'Set OPEN_METEO_API_KEY, or OPEN_METEO_ALLOW_FREE=true for non-commercial use',
    refreshSeconds: 60, staleAfterSeconds: 30 * 60, timeoutMs: 8000,
    fetcher: createOpenMeteoFetcher({ ...AIRPORT, apiKey: env.OPEN_METEO_API_KEY }),
  });

  const traffic = Object.fromEntries(LIVE_SEGMENTS.map(id => {
    const f = geo.features.find((x: any) => x.id === id);
    const seg: SegmentGeometry = { id, name: f.properties.name, coordinates: f.geometry.coordinates, lengthM: lengthById[id] };
    return [id, createProviderService({
      providerId: `tomtom:${id}`, label: 'TomTom Traffic Flow',
      enabled: Boolean(env.TOMTOM_API_KEY), disabledReason: 'Set TOMTOM_API_KEY (server-side) to enable',
      refreshSeconds: 60, staleAfterSeconds: 5 * 60, timeoutMs: 8000,
      fetcher: createTomTomFetcher({ apiKey: env.TOMTOM_API_KEY ?? '', seg, maxMatchDistanceM: 40, statusTable: model.roadStatusBySpeedRatio }),
    })];
  }));

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
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
      if (path === '/api/health') {
        return send(res, 200, { providers: [weather.health(), ...Object.values(traffic).map(s => s.health())] });
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
    configResolved(cfg) { handler = createApi(env, cfg.root, cfg.base); },
    configureServer(server) { server.middlewares.use((req, res, next) => void handler(req, res, next)); },
    configurePreviewServer(server) { server.middlewares.use((req, res, next) => void handler(req, res, next)); },
  };
}
