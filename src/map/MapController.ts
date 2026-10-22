/**
 * Wires the store to the Cesium scene from outside React: each map module is installed once and
 * driven by store subscriptions, so React renders never touch the globe.
 */
import { SCENARIO_MONSOON } from '../data/MockDataService';
import { selectOperational, useApp, type AppState } from '../state/store';
import { installAircraftLayer } from './AircraftLayer';
import { installAirportLayers } from './AirportLayers';
import { flyHome, flyToEntity } from './camera';
import { ENTITY_BY_ID } from './EntityRegistry';
import { createScene, type SceneHandles } from './scene';
import { installSelectionController } from './SelectionController';
import type { RoadStatus } from '../types/telemetry';

export function installMap(container: HTMLElement) {
  const scene: SceneHandles = createScene(container);
  const { viewer } = scene;
  const airport = installAirportLayers(viewer);
  const aircraft = installAircraftLayer(viewer);
  const picker = installSelectionController(viewer, airport.pickIds, {
    select: id => useApp.getState().select(id),
    hover: id => useApp.getState().hover(id),
  });

  // Scenario-derived styling only changes with these inputs; hover/selection reuse the last result.
  let derived: { key: unknown[]; roadStatus: Record<string, RoadStatus>; pulseId: string | null; hazards: Record<string, 'SIMULATED' | 'REPORTED'> } | null = null;
  const scenarioStyle = (s: AppState) => {
    const key = [s.baseline, s.frozenBaseline, s.machine, s.assumptions];
    if (!derived || key.some((k, i) => k !== derived!.key[i])) {
      const op = selectOperational(s);
      derived = {
        key,
        roadStatus: Object.fromEntries(Object.entries(op.traffic).map(([id, env]) => [id, env.data.status])),
        pulseId: op.impactApplied ? SCENARIO_MONSOON.targetEntityId : null,
        hazards: Object.fromEntries(Object.entries(op.traffic)
          .filter(([, env]) => env.data.status === 'BLOCKED' || env.data.status === 'SEVERE')
          .map(([id, env]) => [id, env.state === 'SIMULATION' ? 'SIMULATED' : 'REPORTED'])),
      };
    }
    return derived;
  };

  const restyle = (s: AppState) => {
    const { roadStatus, pulseId, hazards } = scenarioStyle(s);
    airport.applyStyle({
      selectedId: s.selectedEntityId,
      hoveredId: s.hoveredEntityId,
      roadStatus,
      pulseId,
      hazards,
      reducedMotion: s.reducedMotion,
      visible: { roads: s.layers.roads, facilities: s.layers.facilities, runways: s.layers.runways },
    });
  };

  const initial = useApp.getState();
  restyle(initial);
  aircraft.setVisible(initial.layers.aircraft);
  aircraft.setAnimating(!initial.reducedMotion);
  scene.setBuildingsVisible(initial.layers.buildings);
  if (initial.layers.photoreal) void scene.setPhotorealVisible(true);
  flyHome(viewer, 0);

  const unsub = useApp.subscribe((s, prev) => {
    if (
      s.selectedEntityId !== prev.selectedEntityId || s.hoveredEntityId !== prev.hoveredEntityId ||
      s.machine !== prev.machine || s.baseline !== prev.baseline || s.frozenBaseline !== prev.frozenBaseline ||
      s.assumptions !== prev.assumptions || s.layers !== prev.layers || s.reducedMotion !== prev.reducedMotion
    ) restyle(s);
    if (s.layers.aircraft !== prev.layers.aircraft) aircraft.setVisible(s.layers.aircraft);
    if (s.layers.buildings !== prev.layers.buildings) scene.setBuildingsVisible(s.layers.buildings);
    if (s.layers.photoreal !== prev.layers.photoreal) void scene.setPhotorealVisible(s.layers.photoreal);
    if (s.reducedMotion !== prev.reducedMotion) aircraft.setAnimating(!s.reducedMotion);
    if (s.aircraftResetNonce !== prev.aircraftResetNonce) aircraft.reset();
    if (s.settings.sceneMode !== prev.settings.sceneMode) {
      if (s.settings.sceneMode === '2D') viewer.scene.morphTo2D(0.8);
      else {
        viewer.scene.morphTo3D(0.8);
        const done = viewer.scene.morphComplete.addEventListener(() => { done(); flyHome(viewer, 0.8); });
      }
    }
    if (s.focusRequest.nonce !== prev.focusRequest.nonce) {
      const def = s.focusRequest.entityId ? ENTITY_BY_ID[s.focusRequest.entityId] : null;
      if (def) flyToEntity(viewer, def); else flyHome(viewer);
    }
  });

  return {
    viewer,
    destroy() {
      unsub();
      picker.destroy();
      aircraft.destroy();
      airport.destroy();
      scene.destroy();
    },
  };
}
