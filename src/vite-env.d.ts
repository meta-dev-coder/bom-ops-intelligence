/// <reference types="vite/client" />
declare const CESIUM_BASE_URL: string;
declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_CESIUM_ION_TOKEN?: string;
  readonly VITE_DATA_MODE?: 'MOCK' | 'LIVE';
  readonly VITE_ION_IMAGERY_ASSET_ID?: string;
  /** 'true' on static hosts (GitHub Pages): there is no /api proxy, so LIVE mode is unavailable. */
  readonly VITE_STATIC_HOSTING?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
