import { useState } from 'react';
import { FEATURES } from '../config/featureFlags';
import { zoom } from '../map/camera';
import { getViewer } from '../map/CesiumViewer';
import { useApp, type LayerKey } from '../state/store';
import { MapLegend } from './MapLegend';

const LAYER_LABELS: { key: LayerKey; label: string; note?: string }[] = [
  { key: 'buildings', label: '3D buildings (OSM)' },
  { key: 'photoreal', label: 'Photorealistic 3D (Google)', note: 'Replaces OSM buildings' },
  { key: 'roads', label: 'Road overlays' },
  { key: 'facilities', label: 'Terminals & facilities' },
  { key: 'runways', label: 'Runways' },
  { key: 'aircraft', label: 'Aircraft (synthetic)' },
];

export function MapControls() {
  const layers = useApp(s => s.layers);
  const status = useApp(s => s.layerStatus);
  const toggle = useApp(s => s.toggleLayer);
  const focus = useApp(s => s.focus);
  const legend = useApp(s => s.ui.legend);
  const setUi = useApp(s => s.setUi);
  const [open, setOpen] = useState(false);
  const sceneMode = useApp(s => s.settings.sceneMode);
  const setSceneMode = useApp(s => s.setSceneMode);
  const btn = 'glass grid h-9 w-9 place-items-center rounded-lg text-sm text-slate-200 hover:text-white';
  const z = (d: 1 | -1) => { const v = getViewer(); if (v) zoom(v, d); };
  return (
    <div className="pointer-events-none absolute right-3 bottom-24 z-20 flex flex-col items-end gap-2 lg:right-[25rem] lg:bottom-3">
      {legend && <div className="pointer-events-auto"><MapLegend /></div>}
      {open && (
        <div className="glass pointer-events-auto w-60 rounded-lg p-3" role="group" aria-label="Map layers">
          <h2 className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Layers</h2>
          {LAYER_LABELS.filter(l => l.key !== 'photoreal' || FEATURES.photorealToggle).map(l => (
            <label key={l.key} className="flex items-start gap-2 py-0.5 text-xs text-slate-200">
              <input type="checkbox" checked={layers[l.key]} onChange={() => toggle(l.key)} className="mt-0.5" />
              <span>
                {l.label}
                {l.note && <span className="block text-[10px] text-slate-500">{l.note}</span>}
                {status[l.key]?.state === 'loading' && <span className="block text-[10px] text-slate-400">Loading…</span>}
                {status[l.key]?.state === 'error' && <span className="block text-[10px] text-stale">{status[l.key]?.message}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="pointer-events-auto flex flex-col gap-1.5">
        <button type="button" className={btn} onClick={() => z(1)} aria-label="Zoom in">＋</button>
        <button type="button" className={btn} onClick={() => z(-1)} aria-label="Zoom out">－</button>
        <button type="button" className={btn} onClick={() => focus(null)} aria-label="Reset camera to airport view" title="Reset camera">⌂</button>
        <button type="button" className={`${btn} text-[11px] font-semibold`} onClick={() => setSceneMode(sceneMode === '3D' ? '2D' : '3D')} aria-label={`Switch to ${sceneMode === '3D' ? '2D' : '3D'} view`} title={`Switch to ${sceneMode === '3D' ? '2D' : '3D'} view`}>{sceneMode === '3D' ? '2D' : '3D'}</button>
        <button type="button" className={btn} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Layers" title="Layers">≡</button>
        <button type="button" className={btn} onClick={() => setUi({ legend: !legend })} aria-expanded={legend} aria-label="Legend" title="Legend">?</button>
      </div>
    </div>
  );
}
