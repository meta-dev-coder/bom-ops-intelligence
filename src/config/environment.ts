const staticHosting = import.meta.env.VITE_STATIC_HOSTING === 'true';

export const ENV = {
  staticHosting,
  ionToken: import.meta.env.VITE_CESIUM_ION_TOKEN ?? '',
  defaultDataMode: (!staticHosting && import.meta.env.VITE_DATA_MODE === 'LIVE' ? 'LIVE' : 'MOCK') as 'MOCK' | 'LIVE',
  buildLabel: `v${__APP_VERSION__} · ${__BUILD_ID__}${staticHosting ? ' · static' : ''}`,
};
