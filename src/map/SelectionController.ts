/**
 * The one picker (acs-demo had ~10 chained handlers and unthrottled hover picks). Click selects
 * an entity or clears to Airport Overview; hover is throttled to one pick per animation frame.
 */
import { defined, ScreenSpaceEventHandler, ScreenSpaceEventType, type Cartesian2, type Entity, type Viewer } from 'cesium';

export function installSelectionController(viewer: Viewer, pickIds: Map<Entity, string>, on: { select(id: string | null): void; hover(id: string | null): void }) {
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  const idAt = (pos: Cartesian2): string | null => {
    const picked = viewer.scene.pick(pos);
    const entity = defined(picked) ? (picked.id as Entity | undefined) : undefined;
    return entity ? pickIds.get(entity) ?? null : null;
  };

  handler.setInputAction((e: { position: Cartesian2 }) => on.select(idAt(e.position)), ScreenSpaceEventType.LEFT_CLICK);

  let pending: Cartesian2 | null = null;
  let frame = 0;
  handler.setInputAction((e: { endPosition: Cartesian2 }) => {
    pending = e.endPosition;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!pending || viewer.isDestroyed()) return;
      const id = idAt(pending);
      viewer.canvas.style.cursor = id ? 'pointer' : '';
      on.hover(id);
    });
  }, ScreenSpaceEventType.MOUSE_MOVE);

  return {
    destroy() {
      cancelAnimationFrame(frame);
      handler.destroy();
    },
  };
}
