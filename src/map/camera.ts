import { BoundingSphere, Cartesian3, HeadingPitchRange, Math as CMath, type Viewer } from 'cesium';
import { AIRPORT } from '../config/airport';
import type { AirportEntity } from '../types/entities';

/** Fly so the target is centred: flyToBoundingSphere aims at the target, unlike flyTo (acs-demo cameraFraming.js). */
export function flyHome(viewer: Viewer, duration = 1.6) {
  const c = AIRPORT.camera;
  viewer.camera.flyToBoundingSphere(new BoundingSphere(Cartesian3.fromDegrees(c.lon, c.lat), c.radiusM), {
    offset: new HeadingPitchRange(CMath.toRadians(c.headingDeg), CMath.toRadians(c.pitchDeg), c.rangeM),
    duration,
  });
}

export function flyToEntity(viewer: Viewer, e: AirportEntity, duration = 1.2) {
  const pts = e.geometry.type === 'Polygon' ? e.geometry.coordinates[0] : e.geometry.coordinates;
  const sphere = BoundingSphere.fromPoints(pts.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat)));
  const range = Math.max(900, sphere.radius * 3.2);
  viewer.camera.flyToBoundingSphere(sphere, {
    offset: new HeadingPitchRange(CMath.toRadians(AIRPORT.camera.headingDeg), CMath.toRadians(-42), range),
    duration,
  });
}

export function zoom(viewer: Viewer, direction: 1 | -1) {
  const h = viewer.camera.positionCartographic.height;
  if (direction > 0) viewer.camera.zoomIn(h * 0.35);
  else viewer.camera.zoomOut(h * 0.5);
  viewer.scene.requestRender();
}
