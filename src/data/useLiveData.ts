/**
 * The one polling loop in the app (spec §13: no parallel polling in components). In MOCK mode it
 * does nothing and the health panel says so; in LIVE mode it refreshes via our /api proxy and
 * resolves every response through `resolveEnvelope`, so failures surface as STALE/SIMULATION.
 */
import { useEffect } from 'react';
import { DATA_CONFIG } from '../config/dataSources';
import { useApp } from '../state/store';
import type { DataEnvelope, ProviderHealth, TrafficSegment, WeatherRecord } from '../types/telemetry';
import { fetchEnvelope, resolveEnvelope } from './DataService';
import { mockTraffic, mockWeather } from './MockDataService';

const apiUrl = (path: string) => `${import.meta.env.BASE_URL}api/${path}`;

const SYNTHETIC_SOURCES: ProviderHealth[] = [
  { providerId: 'flights', label: 'Flight schedule', state: 'SIMULATION', note: 'Synthetic rows — no licensed schedule provider configured' },
  { providerId: 'aircraft', label: 'Aircraft positions', state: 'SIMULATION', note: 'Deterministic synthetic tracks — OpenSky needs a commercial licence' },
  { providerId: 'demand', label: 'Passenger / forecourt demand', state: 'SIMULATION', note: 'Synthetic aggregate model inputs only' },
];

export function mockHealth(): ProviderHealth[] {
  return [
    { providerId: 'open-meteo', label: 'Weather (Open-Meteo)', state: 'SIMULATION', note: 'Mock Mode — provider not called' },
    { providerId: 'tomtom', label: 'Traffic (TomTom)', state: 'SIMULATION', note: 'Mock Mode — provider not called' },
    ...SYNTHETIC_SOURCES,
  ];
}

export function useLiveData() {
  const dataMode = useApp(s => s.dataMode);

  useEffect(() => {
    const { setProviderHealth } = useApp.getState();
    if (dataMode === 'MOCK') {
      setProviderHealth(mockHealth());
      return;
    }
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      const state = useApp.getState();
      const prev = state.baseline;
      const [w, ...traffic] = await Promise.all([
        fetchEnvelope<WeatherRecord>(apiUrl('weather'), DATA_CONFIG.clientTimeoutMs, ctrl.signal),
        ...Object.keys(prev.traffic).map(id => fetchEnvelope<TrafficSegment>(apiUrl(`traffic/${id}`), DATA_CONFIG.clientTimeoutMs, ctrl.signal)),
      ]);
      if (ctrl.signal.aborted || useApp.getState().dataMode !== 'LIVE') return;
      const now = new Date();
      const fixturesTraffic = mockTraffic();
      const weather = resolveEnvelope({ outcome: w, previous: prev.weather.state === 'SIMULATION' ? null : prev.weather, fixture: mockWeather(), now });
      const trafficIds = Object.keys(prev.traffic);
      const nextTraffic: Record<string, DataEnvelope<TrafficSegment>> = {};
      trafficIds.forEach((id, i) => {
        const p = prev.traffic[id];
        nextTraffic[id] = resolveEnvelope({ outcome: traffic[i], previous: p.state === 'SIMULATION' ? null : p, fixture: fixturesTraffic[id], now });
      });
      useApp.getState().setBaseline({ ...prev, weather, traffic: nextTraffic });

      let serverHealth: ProviderHealth[] = [];
      try {
        const r = await fetch(apiUrl('health'), { signal: ctrl.signal });
        const body = await r.json();
        serverHealth = (body.providers ?? []).map((p: any) => ({
          providerId: p.providerId,
          label: p.label,
          state: p.state,
          lastSuccessAt: p.lastSuccessAt,
          lastAttemptAt: p.lastAttemptAt,
          error: p.error,
          note: p.state === 'DISABLED' ? `${p.note} — using SIMULATION fixture` : p.state === 'UNAVAILABLE' ? 'No data yet — using SIMULATION fixture' : undefined,
        }));
      } catch {
        serverHealth = [{ providerId: 'proxy', label: 'Data proxy (/api)', state: 'UNAVAILABLE', error: 'Proxy unreachable — using fixtures' }];
      }
      if (!ctrl.signal.aborted) useApp.getState().setProviderHealth([...serverHealth, ...SYNTHETIC_SOURCES]);
    };

    const loop = async () => {
      await refresh().catch(err => console.warn('[live-data] refresh failed', err));
      if (!ctrl.signal.aborted) timer = setTimeout(loop, DATA_CONFIG.refreshSeconds * 1000);
    };
    void loop();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [dataMode]);
}
