/**
 * The one polling loop in the app (spec §13: no parallel polling in components). In Simulation
 * mode it does nothing; in Real mode it refreshes weather, roads, flights and aircraft through the
 * /api proxy and resolves every response through `resolveEnvelope`, so failures surface as
 * STALE, or fall back to fixtures that the UI marks as estimates.
 */
import { useEffect } from 'react';
import { DATA_CONFIG } from '../config/dataSources';
import { ENV } from '../config/environment';
import { useApp } from '../state/store';
import type { DataEnvelope, FlightRecord, LiveAircraft, ProviderHealth, TrafficSegment, WeatherRecord } from '../types/telemetry';
import { fetchEnvelope, resolveEnvelope } from './DataService';
import { mockFlights, mockTraffic, mockWeather } from './MockDataService';

const apiUrl = (path: string) => `${ENV.apiBase}api/${path}`;
const AIRCRAFT_REFRESH_S = 15;

/** Sources with no real feed in this PoC; always shown as such. */
const SYNTHETIC_SOURCES: ProviderHealth[] = [
  { providerId: 'demand', label: 'Passenger / forecourt demand', state: 'SIMULATION', note: 'No public source — synthetic aggregate model inputs' },
  { providerId: 'parking', label: 'Parking, stands, cab staging', state: 'SIMULATION', note: 'No public source — configured demo values' },
];

export function mockHealth(): ProviderHealth[] {
  return [
    { providerId: 'weather', label: 'Weather', state: 'SIMULATION', note: 'Simulation mode — fixture' },
    { providerId: 'traffic', label: 'Road traffic', state: 'SIMULATION', note: 'Simulation mode — fixture' },
    { providerId: 'flights', label: 'Flight schedule', state: 'SIMULATION', note: 'Simulation mode — synthetic rows' },
    { providerId: 'aircraft', label: 'Aircraft positions', state: 'SIMULATION', note: 'Simulation mode — deterministic tracks' },
    ...SYNTHETIC_SOURCES,
  ];
}

/** Real mode starts its data window now; fixture rows are re-timed relative to it. */
const nowWindow = () => new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();

export function useLiveData() {
  const dataMode = useApp(s => s.dataMode);
  const refreshSeconds = useApp(s => s.settings.refreshSeconds);

  useEffect(() => {
    const { setProviderHealth, setLiveAircraft } = useApp.getState();
    if (dataMode === 'MOCK') {
      setProviderHealth(mockHealth());
      setLiveAircraft(null);
      return;
    }
    const ctrl = new AbortController();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = DATA_CONFIG.clientTimeoutMs;

    const refresh = async () => {
      const prev = useApp.getState().baseline;
      const roadIds = Object.keys(prev.traffic);
      const [w, f, ...roads] = await Promise.all([
        fetchEnvelope<WeatherRecord>(apiUrl('weather'), t, ctrl.signal),
        fetchEnvelope<FlightRecord[]>(apiUrl('flights'), t, ctrl.signal),
        ...roadIds.map(id => fetchEnvelope<TrafficSegment>(apiUrl(`traffic/${id}`), t, ctrl.signal)),
      ]);
      if (ctrl.signal.aborted || useApp.getState().dataMode !== 'LIVE') return;
      const now = new Date();
      const fixturesTraffic = mockTraffic();
      const keep = <T,>(e: DataEnvelope<T>) => (e.state === 'SIMULATION' ? null : e);
      const weather = resolveEnvelope({ outcome: w, previous: keep(prev.weather), fixture: mockWeather(), now });
      const flights = resolveEnvelope({ outcome: f, previous: keep(prev.flights), fixture: mockFlights(), now });
      const traffic: Record<string, DataEnvelope<TrafficSegment>> = {};
      roadIds.forEach((id, i) => {
        traffic[id] = resolveEnvelope({ outcome: roads[i], previous: keep(prev.traffic[id]), fixture: fixturesTraffic[id], now });
      });
      // Live flights carry ETA offsets relative to the server's fetch time; fixtures are re-timed to now.
      const windowStart = flights.state === 'SIMULATION' ? nowWindow() : flights.observedAt;
      useApp.getState().setBaseline({ ...prev, windowStart, weather, traffic, flights });

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
          note: p.state === 'DISABLED' ? `${p.note} — showing estimates` : p.state === 'UNAVAILABLE' ? 'No data yet — showing estimates' : undefined,
        }));
      } catch {
        serverHealth = [{ providerId: 'proxy', label: 'Data proxy (/api)', state: 'UNAVAILABLE', error: 'Proxy unreachable — showing estimates' }];
      }
      if (!ctrl.signal.aborted) useApp.getState().setProviderHealth([...serverHealth, ...SYNTHETIC_SOURCES]);
    };

    const refreshAircraft = async () => {
      const r = await fetchEnvelope<LiveAircraft[]>(apiUrl('aircraft'), t, ctrl.signal);
      if (ctrl.signal.aborted || useApp.getState().dataMode !== 'LIVE') return;
      const prev = useApp.getState().liveAircraft;
      if (r.ok) setLiveAircraft(r.envelope);
      else if (prev) setLiveAircraft({ ...prev, state: 'STALE', errorCode: r.error });
    };

    const every = (fn: () => Promise<void>, seconds: number) => {
      const loop = async () => {
        await fn().catch(err => console.warn('[live-data] refresh failed', err));
        if (!ctrl.signal.aborted) timers.push(setTimeout(loop, seconds * 1000));
      };
      void loop();
    };
    // Re-time fixtures immediately so Real mode never shows the 18:30 demo window.
    const b = useApp.getState().baseline;
    useApp.getState().setBaseline({ ...b, windowStart: nowWindow() });
    every(refresh, refreshSeconds);
    every(refreshAircraft, AIRCRAFT_REFRESH_S);
    return () => {
      ctrl.abort();
      timers.forEach(clearTimeout);
    };
  }, [dataMode, refreshSeconds]);
}
