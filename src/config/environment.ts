const staticHosting = import.meta.env.VITE_STATIC_HOSTING === 'true';
/** Where /api lives: same origin by default, or an external proxy for static hosting (must end with '/'). */
const apiBase = import.meta.env.VITE_API_BASE || import.meta.env.BASE_URL;

export const ENV = {
  staticHosting,
  apiBase,
  /** Real mode needs the /api proxy: same-origin server, or VITE_API_BASE on a static host. */
  realDataAvailable: !staticHosting || Boolean(import.meta.env.VITE_API_BASE),
  ionToken: import.meta.env.VITE_CESIUM_ION_TOKEN ?? '',
  defaultDataMode: ((!staticHosting || import.meta.env.VITE_API_BASE) && import.meta.env.VITE_DATA_MODE === 'LIVE' ? 'LIVE' : 'MOCK') as 'MOCK' | 'LIVE',
  buildLabel: `v${__APP_VERSION__} · ${__BUILD_ID__}${staticHosting ? ' · static' : ''}`,
};
