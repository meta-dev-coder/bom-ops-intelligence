/**
 * One cached provider feed (pattern from acs-demo cesium-poc server/fl511Service.mjs).
 * Fetches on demand — at most once per refresh interval, never in parallel — keeps the last good
 * envelope, and degrades in one direction: a failure serves the cached value as STALE, or reports
 * UNAVAILABLE so the client can fall back to its SIMULATION fixture. A failure is never LIVE.
 */
import type { DataEnvelope } from '../src/types/telemetry';

export interface ProviderHealthSnapshot {
  providerId: string;
  label: string;
  enabled: boolean;
  state: 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'DISABLED';
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  error?: string;
  note?: string;
}

export interface ProviderServiceOptions<T> {
  providerId: string;
  label: string;
  /** False when credentials/licence are not configured; the provider is then never called. */
  enabled: boolean;
  disabledReason?: string;
  refreshSeconds: number;
  staleAfterSeconds: number;
  timeoutMs: number;
  retries?: number;
  fetcher: (signal: AbortSignal) => Promise<{ data: T; observedAt: string; quality: string }>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  log?: Pick<Console, 'warn'>;
}

export type ProviderResult<T> = { envelope: DataEnvelope<T> } | { error: string; status: number };

/** Strip anything that looks like a credential before it reaches a log or a response. */
export function redact(message: string): string {
  return message.replace(/(\b(key|apikey|api_key|token|access_token)=)[^&\s"]+/gi, '$1***').replace(/Bearer\s+[\w.-]+/gi, 'Bearer ***');
}

export function createProviderService<T>(o: ProviderServiceOptions<T>) {
  const now = o.now ?? Date.now;
  const sleep = o.sleep ?? (ms => new Promise(r => setTimeout(r, ms)));
  const log = o.log ?? console;
  let cached: DataEnvelope<T> | null = null;
  let lastAttempt: number | null = null;
  let lastError: string | undefined;
  let inFlight: Promise<void> | null = null;

  async function attempt(): Promise<void> {
    const retries = o.retries ?? 1;
    for (let i = 0; i <= retries; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), o.timeoutMs);
      try {
        const r = await o.fetcher(ctrl.signal);
        const iso = new Date(now()).toISOString();
        cached = {
          data: r.data, sourceId: o.providerId, sourceLabel: o.label, state: 'LIVE',
          observedAt: r.observedAt, fetchedAt: iso, staleAfterSeconds: o.staleAfterSeconds, quality: r.quality,
        };
        lastError = undefined;
        return;
      } catch (err) {
        lastError = ctrl.signal.aborted ? 'TIMEOUT' : redact(err instanceof Error ? err.message : String(err));
        log.warn(`[provider:${o.providerId}] attempt ${i + 1} failed: ${lastError}`);
        if (i < retries) await sleep(500 * 2 ** i);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  /** One rule for STALE, shared by get() and health(). */
  function staleReason(): string | null {
    if (!cached) return null;
    if (lastError) return lastError;
    const ageS = (now() - Date.parse(cached.observedAt)) / 1000;
    return !Number.isFinite(ageS) || ageS > o.staleAfterSeconds ? 'EXCEEDED_FRESHNESS' : null;
  }

  async function get(): Promise<ProviderResult<T>> {
    if (!o.enabled) return { error: o.disabledReason ?? 'PROVIDER_DISABLED', status: 503 };
    const due = lastAttempt === null || now() - lastAttempt >= o.refreshSeconds * 1000;
    if (due) {
      lastAttempt = now();
      inFlight ??= attempt().finally(() => { inFlight = null; });
    }
    if (inFlight) await inFlight;
    if (!cached) return { error: lastError ?? 'NO_DATA', status: 503 };
    const reason = staleReason();
    return { envelope: reason ? { ...cached, state: 'STALE', errorCode: reason } : cached };
  }

  function health(): ProviderHealthSnapshot {
    if (!o.enabled) return { providerId: o.providerId, label: o.label, enabled: false, state: 'DISABLED', note: o.disabledReason };
    const reason = staleReason();
    const state = !cached ? 'UNAVAILABLE' : reason ? 'STALE' : 'LIVE';
    return {
      providerId: o.providerId, label: o.label, enabled: true, state,
      lastSuccessAt: cached?.fetchedAt,
      lastAttemptAt: lastAttempt !== null ? new Date(lastAttempt).toISOString() : undefined,
      error: lastError ?? (reason ?? undefined),
    };
  }

  return { get, health };
}
