import { ENV } from '../../config/environment';
import { roleLabel } from '../../config/roles';
import { useApp, useCan } from '../../state/store';

export function SettingsPanel() {
  const open = useApp(s => s.ui.settings);
  const setUi = useApp(s => s.setUi);
  const dataMode = useApp(s => s.dataMode);
  const setDataMode = useApp(s => s.setDataMode);
  const reducedMotion = useApp(s => s.reducedMotion);
  const setReducedMotion = useApp(s => s.setReducedMotion);
  const role = useApp(s => s.role);
  const canSwitch = useCan('dataMode.switch');
  const scenarioIdle = useApp(s => s.machine.phase === 'IDLE' && s.machine.stepIndex === 0);
  if (!open) return null;
  return (
    <div role="dialog" aria-label="Settings" className="glass pointer-events-auto absolute top-14 right-3 z-40 w-80 rounded-xl p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Settings</h2>
        <button type="button" onClick={() => setUi({ settings: false })} aria-label="Close settings" className="text-slate-400 hover:text-white">✕</button>
      </div>
      <fieldset className="space-y-1.5" disabled={!canSwitch}>
        <legend className="mb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Data mode</legend>
        {(['MOCK', 'LIVE'] as const).map(m => (
          <label key={m} className="flex items-start gap-2 text-xs text-slate-200">
            <input type="radio" name="mode" checked={dataMode === m} disabled={m === 'LIVE' && ENV.staticHosting} onChange={() => setDataMode(m)} className="mt-0.5" />
            <span>
              <strong>{m === 'MOCK' ? 'Mock Mode' : 'Live Data'}</strong>
              <span className="block text-[11px] text-slate-400">
                {m === 'MOCK' ? 'Deterministic fixtures — presentation default.' : ENV.staticHosting ? 'Not available on this static deployment (no server proxy for provider keys).' : 'Weather & traffic via server proxy where licensed and configured; failures show STALE or fall back to SIMULATION.'}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {!canSwitch && <p className="mt-1 text-[10px] text-slate-500">{roleLabel(role)} cannot change the data mode (Administrator / Demo Operator only).</p>}
      {canSwitch && !scenarioIdle && <p className="mt-1 text-[10px] text-stale">Switching data mode resets the active scenario to baseline.</p>}
      <label className="mt-4 flex items-center gap-2 text-xs text-slate-200">
        <input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} />
        Reduce motion (pauses aircraft, static highlights)
      </label>
      <p className="mt-4 text-[10px] leading-snug text-slate-500">
        Notification sound: off (MVP has no audio). No e-mail, SMS or push notifications are sent. Roles are a demo selector, not production security.
      </p>
    </div>
  );
}
