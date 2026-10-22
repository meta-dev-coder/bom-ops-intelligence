/** Refresh/stale settings are configuration, not literals scattered through components (§11.4). */
export const DATA_CONFIG = {
  refreshSeconds: 60,
  weather: { staleAfterSeconds: 30 * 60 },
  traffic: { staleAfterSeconds: 5 * 60 },
  clientTimeoutMs: 12_000,
} as const;
