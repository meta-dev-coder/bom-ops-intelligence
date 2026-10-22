// Must run before any Cesium module evaluates: tells Cesium where its copied static assets live.
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = CESIUM_BASE_URL;
export {};
