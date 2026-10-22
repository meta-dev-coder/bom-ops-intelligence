import { useEffect, useState } from 'react';
import { AIRPORT } from '../../config/airport';
import { ENV } from '../../config/environment';
import { ROLES, type RoleId } from '../../config/roles';
import { useCan } from '../../state/store';
import { useApp } from '../../state/store';
import { istTime } from '../format';

export function TopBar() {
  const dataMode = useApp(s => s.dataMode);
  const role = useApp(s => s.role);
  const setRole = useApp(s => s.setRole);
  const windowStart = useApp(s => (s.frozenBaseline ?? s.baseline).windowStart);
  const phase = useApp(s => s.machine.phase);
  const ui = useApp(s => s.ui);
  const setUi = useApp(s => s.setUi);
  const reset = useApp(s => s.resetScenario);
  const focus = useApp(s => s.focus);
  const select = useApp(s => s.select);
  const canReset = useCan('scenario.run');
  const setDemo = useApp(s => s.setDemo);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(id); }, []);

  const btn = 'rounded-md border border-line px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-400';
  return (
    <header className="glass pointer-events-auto absolute top-0 right-0 left-0 z-30 flex h-12 items-center gap-3 border-x-0 border-t-0 px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-md bg-accent/15 font-mono text-[11px] font-bold text-accent">BOM</span>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-sm font-semibold text-white">Operations Intelligence <span className="font-normal text-slate-400">PoC</span></h1>
          <p className="hidden truncate text-[10px] text-slate-400 sm:block">{AIRPORT.name}, {AIRPORT.city}</p>
        </div>
      </div>

      <span
        data-tour="mode-badge"
        className={`ml-1 hidden items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide sm:inline-flex ${dataMode === 'MOCK' ? 'border-sim/50 bg-sim/10 text-sim' : 'border-live/50 bg-live/10 text-live'}`}
        title={ENV.buildLabel}
      >
        <span aria-hidden="true">{dataMode === 'MOCK' ? '◆' : '●'}</span>{dataMode === 'MOCK' ? 'MOCK MODE' : 'LIVE DATA'}
      </span>
      <span className="hidden font-mono text-[10px] text-slate-500 xl:inline" title="Build">{ENV.buildLabel}</span>
      {phase !== 'IDLE' && <span className="hidden rounded border border-amber-400/50 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 md:inline">SCENARIO {phase}</span>}

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden text-right leading-tight md:block">
          <div className="tabular text-xs text-slate-200">{istTime(now)}</div>
          <div className="text-[10px] text-slate-500">{dataMode === 'MOCK' ? `Data window ${istTime(windowStart)} · simulation` : 'Live refresh 60 s'}</div>
        </div>
        <label className="sr-only" htmlFor="role">Demo role</label>
        <select id="role" value={role} onChange={e => setRole(e.target.value as RoleId)} className="max-w-[9.5rem] rounded-md border border-line bg-ink-900 px-2 py-1.5 text-xs text-slate-100" title="Demo role selector — not production security">
          {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button type="button" className={`${btn} lg:hidden`} aria-pressed={ui.left} onClick={() => setUi({ left: !ui.left, right: window.innerWidth < 768 ? false : ui.right })}>Telemetry</button>
        <button type="button" className={`${btn} lg:hidden`} aria-pressed={ui.right} onClick={() => setUi({ right: !ui.right, left: window.innerWidth < 768 ? false : ui.left })}>Inspector</button>
        <button type="button" className={btn} onClick={() => { if (canReset) reset(); select(null); focus(null); }} title={canReset ? 'Reset scenario and camera' : 'Reset camera and selection'} aria-label={canReset ? 'Reset scenario and camera' : 'Reset camera and selection'}>{canReset ? 'Reset' : 'Reset view'}</button>
        <button type="button" className={btn} onClick={() => setDemo({ mode: 'start' })} title="Open the guided demo">Guide</button>
        <button type="button" className={btn} onClick={() => setUi({ history: !ui.history })} aria-pressed={ui.history}>History</button>
        <button type="button" className={btn} onClick={() => setUi({ settings: !ui.settings })} aria-pressed={ui.settings} aria-label="Settings">⚙</button>
      </div>
    </header>
  );
}
