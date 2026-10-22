/**
 * Client side of the data contract (spec §7.2). The browser only ever talks to our own
 * `/api/*` proxy; provider keys stay on the server. `resolveEnvelope` is the single place that
 * decides LIVE / STALE / SIMULATION, so a failed request can never be shown as LIVE.
 */
import type { DataEnvelope } from '../types/telemetry';

export type FetchOutcome<T> = { ok: true; envelope: DataEnvelope<T> } | { ok: false; error: string };

export function resolveEnvelope<T>(args: {
  outcome: FetchOutcome<T>;
  previous: DataEnvelope<T> | null;
  fixture: DataEnvelope<T>;
  now: Date;
}): DataEnvelope<T> {
  const { outcome, previous, fixture, now } = args;
  if (outcome.ok) {
    const env = outcome.envelope;
    // The server may already say STALE; we additionally age LIVE data on the client.
    const ageS = (now.getTime() - Date.parse(env.observedAt)) / 1000;
    if (env.state === 'LIVE' && Number.isFinite(ageS) && ageS > env.staleAfterSeconds) {
      return { ...env, state: 'STALE', errorCode: env.errorCode ?? 'EXCEEDED_FRESHNESS' };
    }
    if (env.state === 'SIMULATION') return env;
    return env;
  }
  if (previous && previous.state !== 'SIMULATION') {
    return { ...previous, state: 'STALE', errorCode: outcome.error };
  }
  return { ...fixture, errorCode: outcome.error };
}

export async function fetchEnvelope<T>(url: string, timeoutMs: number, signal?: AbortSignal): Promise<FetchOutcome<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.envelope) return { ok: false, error: body?.error ?? `HTTP_${res.status}` };
    return { ok: true, envelope: body.envelope as DataEnvelope<T> };
  } catch (err) {
    return { ok: false, error: ctrl.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
