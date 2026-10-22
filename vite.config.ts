import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { apiPlugin } from './server/apiPlugin';

/**
 * Cesium's static assets are copied explicitly and CESIUM_BASE_URL is derived from `base`
 * (acs-demo hit Cesium.js 404s under a sub-path with vite-plugin-cesium, commit 8e79b33).
 * Server-only keys are read with loadEnv(..., '') because Vite only exposes VITE_* to the client.
 */
const CESIUM_SRC = 'node_modules/cesium/Build/Cesium';
const CESIUM_DIR = 'cesiumStatic';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Normalise to '/x/' so CESIUM_BASE_URL always joins with a slash (BASE_PATH=/poc → /poc/).
  const base = `/${(env.BASE_PATH || '').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
  return {
    base,
    define: { CESIUM_BASE_URL: JSON.stringify(`${base}${CESIUM_DIR}`) },
    plugins: [
      react(),
      tailwindcss(),
      viteStaticCopy({
        targets: ['ThirdParty', 'Workers', 'Assets', 'Widgets'].map(d => ({ src: `${CESIUM_SRC}/${d}`, dest: CESIUM_DIR })),
      }),
      apiPlugin({
        TOMTOM_API_KEY: env.TOMTOM_API_KEY,
        OPEN_METEO_API_KEY: env.OPEN_METEO_API_KEY,
        OPEN_METEO_ALLOW_FREE: env.OPEN_METEO_ALLOW_FREE,
      }),
    ],
    build: { target: 'esnext', chunkSizeWarningLimit: 6000 },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173 },
  };
});
