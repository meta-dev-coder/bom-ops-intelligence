/** Spec §5.1: the initial camera target is a viewing coordinate, not a surveyed asset location. */
export const AIRPORT = {
  code: 'BOM',
  name: 'Chhatrapati Shivaji Maharaj International Airport',
  city: 'Mumbai',
  timeZone: 'Asia/Kolkata',
  camera: { lon: 72.8656, lat: 19.0896, rangeM: 6200, headingDeg: 15, pitchDeg: -38, radiusM: 1200 },
};

/** Cesium ion assets from the "BOM Airport" story (verified readable with the project token). */
export const ION_ASSETS = {
  worldTerrain: 1,
  osmBuildings: 96188,
  googleSatelliteLabels: Number(import.meta.env.VITE_ION_IMAGERY_ASSET_ID ?? 3830186),
  googlePhotorealistic: 2275207,
};
