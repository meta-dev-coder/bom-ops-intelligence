/**
 * Viewer + base layers (spec §5.1). Every layer degrades on its own and reports its status to
 * the store; nothing here throws past the caller, and attribution stays in Cesium's credit area.
 */
import {
  Cesium3DTileset, Cesium3DTileStyle, Color, createOsmBuildingsAsync, Credit, EllipsoidTerrainProvider, ImageryLayer,
  Ion, IonImageryProvider, Terrain, UrlTemplateImageryProvider, Viewer,
} from 'cesium';
import { ION_ASSETS } from '../config/airport';
import { ENV } from '../config/environment';
import { useApp } from '../state/store';
import { ENTITY_ATTRIBUTION } from './EntityRegistry';

export interface SceneHandles {
  viewer: Viewer;
  setBuildingsVisible(v: boolean): void;
  setPhotorealVisible(v: boolean): Promise<void>;
  destroy(): void;
}

export function createScene(container: HTMLElement): SceneHandles {
  const status = useApp.getState().setLayerStatus;
  const hasToken = Boolean(ENV.ionToken);
  if (hasToken) Ion.defaultAccessToken = ENV.ionToken;

  const terrain = hasToken ? Terrain.fromWorldTerrain() : undefined;
  const viewer = new Viewer(container, {
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false, baseLayer: false,
    terrain, terrainProvider: terrain ? undefined : new EllipsoidTerrainProvider(),
    // Render on demand; the aircraft clock keeps frames coming only while it is animating.
    requestRenderMode: true, maximumRenderTimeChange: 0.1,
  });
  viewer.scene.globe.baseColor = Color.fromCssColorString('#0b1220');
  viewer.scene.backgroundColor = Color.fromCssColorString('#05080f');
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.fog.enabled = true;
  viewer.creditDisplay.addStaticCredit(new Credit(ENTITY_ATTRIBUTION, true));

  if (terrain) {
    status('terrain', { state: 'loading' });
    terrain.readyEvent.addEventListener(() => status('terrain', { state: 'ready' }));
    terrain.errorEvent.addEventListener(() => status('terrain', { state: 'error', message: 'Cesium World Terrain unavailable — flat ellipsoid' }));
  } else {
    status('terrain', { state: 'off', message: 'No ion token — flat ellipsoid' });
  }

  // Imagery: Google Maps 2D satellite via ion; Esri World Imagery when there is no token.
  status('imagery', { state: 'loading' });
  const imagery = hasToken
    ? ImageryLayer.fromProviderAsync(IonImageryProvider.fromAssetId(ION_ASSETS.googleSatelliteLabels))
    : ImageryLayer.fromProviderAsync(Promise.resolve(new UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        credit: 'Imagery © Esri, Maxar, Earthstar Geographics', maximumLevel: 19,
      })));
  imagery.readyEvent.addEventListener(() => { status('imagery', { state: 'ready' }); viewer.scene.requestRender(); });
  imagery.errorEvent.addEventListener(() => status('imagery', { state: 'error', message: 'Base imagery failed to load' }));
  viewer.imageryLayers.add(imagery);

  let buildings: Cesium3DTileset | null = null;
  let buildingsWanted = useApp.getState().layers.buildings;
  if (hasToken) {
    status('buildings', { state: 'loading' });
    createOsmBuildingsAsync({
      style: new Cesium3DTileStyle({ color: "color('#c8d3e0', 0.92)" }),
    }).then(ts => {
      if (viewer.isDestroyed()) return;
      buildings = ts;
      ts.show = buildingsWanted;
      viewer.scene.primitives.add(ts);
      status('buildings', { state: buildingsWanted ? 'ready' : 'off' });
      viewer.scene.requestRender();
    }).catch(err => {
      console.warn('[scene] OSM Buildings failed', err);
      status('buildings', { state: 'error', message: 'Cesium OSM Buildings unavailable' });
    });
  } else {
    status('buildings', { state: 'off', message: 'Needs an ion token' });
  }

  let photoreal: Cesium3DTileset | null = null;
  let photorealLoading: Promise<Cesium3DTileset | null> | null = null;

  return {
    viewer,
    setBuildingsVisible(v) {
      buildingsWanted = v;
      if (buildings) { buildings.show = v; status('buildings', { state: v ? 'ready' : 'off' }); }
      viewer.scene.requestRender();
    },
    async setPhotorealVisible(v) {
      if (!v) {
        if (photoreal) photoreal.show = false;
        viewer.scene.globe.show = true;
        status('photoreal', { state: 'off' });
        viewer.scene.requestRender();
        return;
      }
      if (!hasToken) { status('photoreal', { state: 'error', message: 'Needs an ion token' }); return; }
      status('photoreal', { state: 'loading' });
      photorealLoading ??= Cesium3DTileset.fromIonAssetId(ION_ASSETS.googlePhotorealistic, { showCreditsOnScreen: true })
        .then(ts => { if (!viewer.isDestroyed()) viewer.scene.primitives.add(ts); return ts; })
        .catch(err => { console.warn('[scene] Photorealistic tiles failed', err); photorealLoading = null; return null; });
      photoreal = await photorealLoading;
      if (!photoreal) { status('photoreal', { state: 'error', message: 'Google Photorealistic 3D Tiles unavailable' }); return; }
      // Only hide the globe once tiles exist, so a failure never leaves a blank scene.
      if (useApp.getState().layers.photoreal) {
        photoreal.show = true;
        viewer.scene.globe.show = false;
        status('photoreal', { state: 'ready' });
      }
      viewer.scene.requestRender();
    },
    destroy() {
      if (!viewer.isDestroyed()) viewer.destroy();
    },
  };
}
