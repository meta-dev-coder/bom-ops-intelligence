import { DataSourceHealth } from '../../components/DataSourceHealth';
import { FlightBoard } from '../../components/FlightBoard';
import { TrafficCard } from '../../components/TrafficCard';
import { WeatherCard } from '../../components/WeatherCard';
import { useApp, useOperational } from '../../state/store';

export function LeftTelemetryPanel() {
  const open = useApp(s => s.ui.left);
  const setUi = useApp(s => s.setUi);
  const windowStart = useApp(s => (s.frozenBaseline ?? s.baseline).windowStart);
  const selected = useApp(s => s.selectedEntityId);
  const { current } = useOperational();
  return (
    <aside
      aria-label="Telemetry"
      className={`glass scroll-thin pointer-events-auto absolute top-14 bottom-3 left-3 z-20 w-[min(21rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-[110%]'}`}
    >
      <div className="flex items-center justify-between px-3.5 pt-2.5 lg:hidden">
        <span className="text-xs font-semibold text-slate-300">Telemetry</span>
        <button type="button" onClick={() => setUi({ left: false })} aria-label="Close telemetry" className="text-slate-400">✕</button>
      </div>
      <WeatherCard env={current.weather} />
      <TrafficCard segments={Object.values(current.traffic)} />
      <FlightBoard env={current.flights} windowStart={windowStart} highlightTerminal={selected?.startsWith('terminal-') ? selected : null} />
      <DataSourceHealth />
    </aside>
  );
}
