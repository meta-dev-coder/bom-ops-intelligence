import { defineConfig } from '@playwright/test';

/**
 * Browser smoke test (spec §11.1: "browser-based smoke test for map and reset").
 * Headless WebGL runs on SwiftShader; few workers and a long timeout keep it stable
 * (the same settings acs-demo/cesium-poc needed).
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
