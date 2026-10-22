import { EntityInspector } from '../../components/EntityInspector';
import { ScenarioControls } from '../../components/ScenarioControls';
import { useApp } from '../../state/store';

export function RightIntelligencePanel() {
  const open = useApp(s => s.ui.right);
  const setUi = useApp(s => s.setUi);
  return (
    <aside
      aria-label="Intelligence"
      className={`glass scroll-thin pointer-events-auto absolute top-14 right-3 bottom-3 z-20 w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl transition-transform duration-200 lg:translate-x-0 ${open ? 'translate-x-0' : 'translate-x-[110%]'}`}
    >
      <div className="flex justify-end px-3.5 pt-2 lg:hidden">
        <button type="button" onClick={() => setUi({ right: false })} aria-label="Close inspector" className="text-slate-400">✕</button>
      </div>
      <EntityInspector />
      <ScenarioControls />
    </aside>
  );
}
