import { ROAD_COLORS, TYPE_COLORS } from '../map/AirportLayers';
import { STATUS_LABEL } from './TrafficCard';

export function MapLegend() {
  const sw = (c: string, kind: 'line' | 'fill' = 'fill') => (
    <span aria-hidden="true" className={kind === 'line' ? 'inline-block h-1.5 w-5 rounded' : 'inline-block h-3 w-3 rounded-sm border'} style={kind === 'line' ? { background: c } : { background: `${c}55`, borderColor: c }} />
  );
  return (
    <div className="glass w-56 rounded-lg p-3 text-[11px] text-slate-300">
      <h2 className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Legend</h2>
      <p className="mb-1 text-slate-400">Road status</p>
      <ul className="mb-2 space-y-0.5">
        {(Object.keys(ROAD_COLORS) as (keyof typeof ROAD_COLORS)[]).map(k => <li key={k} className="flex items-center gap-2">{sw(ROAD_COLORS[k], 'line')}{STATUS_LABEL[k]}</li>)}
      </ul>
      <p className="mb-1 text-slate-400">Facilities</p>
      <ul className="mb-2 space-y-0.5">
        <li className="flex items-center gap-2">{sw(TYPE_COLORS.TERMINAL)}Terminal</li>
        <li className="flex items-center gap-2">{sw(TYPE_COLORS.PARKING)}Parking / MLCP</li>
        <li className="flex items-center gap-2">{sw(TYPE_COLORS.RUNWAY)}Runway</li>
        <li className="flex items-center gap-2">{sw(TYPE_COLORS.FACILITY)}Other facility</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm border-2 border-white" />Selected</li>
        <li className="flex items-center gap-2">{sw('#f59e0b')}Scenario impact (pulsing)</li>
      </ul>
      <p className="mb-1 text-slate-400">Aircraft (synthetic)</p>
      <ul className="space-y-0.5">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="text-sky-300">✈</span>Arrival</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="text-violet-300">✈</span>Departure</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="rain inline-block h-3 w-5 rounded-sm border border-sky-300/40" />Simulated heavy rain</li>
      </ul>
    </div>
  );
}
