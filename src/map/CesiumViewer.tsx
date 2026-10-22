import { useEffect, useRef } from 'react';
import type { Viewer } from 'cesium';
import { installMap } from './MapController';

let activeViewer: Viewer | null = null;
/** For map controls (zoom) that need the viewer without putting it in React state. */
export const getViewer = () => activeViewer;

/**
 * Mounts the globe exactly once per container. StrictMode's double mount runs destroy() before
 * the second install, so there is never more than one Viewer.
 */
export function CesiumViewer() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = installMap(ref.current);
    activeViewer = map.viewer;
    return () => {
      activeViewer = null;
      map.destroy();
    };
  }, []);
  return <div ref={ref} className="absolute inset-0 z-0" role="application" aria-label="3D map of Mumbai airport. Click a facility to inspect it." />;
}
