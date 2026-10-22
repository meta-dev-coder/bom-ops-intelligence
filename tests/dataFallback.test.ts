import { describe, expect, it } from 'vitest';
import { resolveEnvelope } from '../src/data/DataService';
import { mockWeather } from '../src/data/MockDataService';
import type { DataEnvelope, WeatherRecord } from '../src/types/telemetry';

const now = new Date('2026-10-21T13:00:00Z');
const live = (observedAt: string): DataEnvelope<WeatherRecord> => ({
  ...mockWeather(), state: 'LIVE', sourceId: 'open-meteo', sourceLabel: 'Open-Meteo', observedAt, fetchedAt: observedAt,
  data: { ...mockWeather().data, kind: 'MODEL' },
});

describe('resolveEnvelope (FR-10, SC-05)', () => {
  it('keeps a fresh LIVE response LIVE', () => {
    const env = resolveEnvelope({ outcome: { ok: true, envelope: live('2026-10-21T12:55:00Z') }, previous: null, fixture: mockWeather(), now });
    expect(env.state).toBe('LIVE');
  });

  it('downgrades LIVE data older than its freshness threshold to STALE', () => {
    const env = resolveEnvelope({ outcome: { ok: true, envelope: live('2026-10-21T11:00:00Z') }, previous: null, fixture: mockWeather(), now });
    expect(env.state).toBe('STALE');
    expect(env.errorCode).toBe('EXCEEDED_FRESHNESS');
  });

  it('a failed request with a cached live value becomes STALE, keeping the last timestamp', () => {
    const prev = live('2026-10-21T12:58:00Z');
    const env = resolveEnvelope({ outcome: { ok: false, error: 'TIMEOUT' }, previous: prev, fixture: mockWeather(), now });
    expect(env.state).toBe('STALE');
    expect(env.observedAt).toBe(prev.observedAt);
    expect(env.errorCode).toBe('TIMEOUT');
  });

  it('a failed request with no cache falls back to the SIMULATION fixture — never LIVE', () => {
    const env = resolveEnvelope({ outcome: { ok: false, error: 'NETWORK_ERROR' }, previous: null, fixture: mockWeather(), now });
    expect(env.state).toBe('SIMULATION');
    expect(env.data).toEqual(mockWeather().data);
  });

  it('does not turn a previous SIMULATION value into STALE', () => {
    const env = resolveEnvelope({ outcome: { ok: false, error: 'HTTP_503' }, previous: mockWeather(), fixture: mockWeather(), now });
    expect(env.state).toBe('SIMULATION');
  });
});
