import { useState } from 'react';
import { ENV } from '../../config/environment';
import { roleLabel } from '../../config/roles';
import { BASELINE_FIXTURE } from '../../data/MockDataService';
import { ENTITIES } from '../../map/EntityRegistry';
import { useApp, useCan } from '../../state/store';
import { playChime } from '../useAlertSound';
import { istDateTime } from '../format';
import { StatusTag } from '../../components/StatusTag';

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mt-4 mb-1.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{children}</h3>
);

/** Admin (spec §10, §11.4): refresh interval, provider configuration and geometry registry. Secrets are never shown. */
function AdminConfig() {
  const refresh = useApp(s => s.settings.refreshSeconds);
  const setRefresh = useApp(s => s.setRefreshSeconds);
  const health = useApp(s => s.providerHealth);
  const dataMode = useApp(s => s.dataMode);
  return (
    <>
      <H>Configuration (Administrator)</H>
      <label className="flex items-center justify-between gap-2 text-xs text-slate-200">
        Provider refresh interval
        <select value={refresh} onChange={e => setRefresh(Number(e.target.value))} className="rounded border border-line bg-ink-900 px-2 py-1 text-xs">
          {[30, 60, 120, 300].map(s => <option key={s} value={s}>{s} s</option>)}
        </select>
      </label>
      <p className="mt-1 text-[10px] text-slate-500">Changes are logged in Event history. Respect each provider's rate limits.</p>
      <p className="mt-2 text-[11px] text-slate-300">Provider adapters {dataMode === 'MOCK' && <span className="text-slate-500">(switch to Live to query the server)</span>}</p>
      <ul className="mt-1 space-y-1">
        {health.map(p => (
          <li key={p.providerId} className="flex items-start justify-between gap-2 text-[11px]">
            <span className="text-slate-300">{p.label}<span className="block text-[10px] text-slate-500">{p.note ?? (p.state === 'DISABLED' ? 'Credentials not configured on the server' : 'Credentials held server-side')}</span></span>
            <StatusTag state={p.state} />
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-slate-500">API keys are set as server environment variables (see .env.example) and are never displayed here.</p>
      <details className="mt-2 text-[11px]">
        <summary className="cursor-pointer text-slate-300">Geometry registry ({ENTITIES.length} entities)</summary>
        <ul className="mt-1 space-y-1">
          {ENTITIES.map(e => (
            <li key={e.id} className="text-[10px] text-slate-400"><span className="text-slate-200">{e.name}</span> · {e.type} · {e.geometryConfidence} confidence · {e.reviewStatus.split(' — ')[0]}<br />{e.geometrySource}</li>
          ))}
        </ul>
      </details>
    </>
  );
}

/** Demo Operator (spec §10): fixtures, scenario diagnostics, reset environment. */
function Diagnostics() {
  const results = useApp(s => s.scenarioResults);
  const canFixtures = useCan('fixtures.view');
  const canReset = useCan('environment.reset');
  const resetEnvironment = useApp(s => s.resetEnvironment);
  const [confirm, setConfirm] = useState(false);
  const last = results[0];
  return (
    <>
      <H>Scenario diagnostics</H>
      {!last ? <p className="text-[11px] text-slate-500">No completed scenario run yet.</p> : (
        <>
          <p className="text-[11px] text-slate-300">{last.runId} · v{last.version} · {istDateTime(last.createdAt)}</p>
          <pre className="scroll-thin mt-1 max-h-40 overflow-auto rounded border border-line bg-ink-950/80 p-2 font-mono text-[10px] leading-snug text-slate-300">
            {JSON.stringify({ inputs: last.inputs, outputs: last.outputs }, null, 1)}
          </pre>
          <button type="button" onClick={() => download(`${last.runId}.json`, last)} className="mt-1 rounded border border-line px-2 py-1 text-[11px] text-slate-200 hover:border-slate-400">Download scenario record (JSON)</button>
          {results.length > 1 && <p className="mt-1 text-[10px] text-slate-500">{results.length} runs this session; outputs are identical for identical inputs.</p>}
        </>
      )}
      {canFixtures && (
        <>
          <H>Mock fixtures</H>
          <p className="text-[11px] text-slate-300">{BASELINE_FIXTURE.fixtureId} · window {istDateTime(BASELINE_FIXTURE.windowStart)} · {BASELINE_FIXTURE.windowMinutes} min</p>
          <p className="text-[10px] text-slate-500">{BASELINE_FIXTURE.flights.length} flights · {BASELINE_FIXTURE.traffic.length} road segments · {BASELINE_FIXTURE.aircraft.length} aircraft tracks</p>
          <button type="button" onClick={() => download(`${BASELINE_FIXTURE.fixtureId}.json`, BASELINE_FIXTURE)} className="mt-1 rounded border border-line px-2 py-1 text-[11px] text-slate-200 hover:border-slate-400">Download baseline fixture</button>
        </>
      )}
      {canReset && (
        <>
          <H>Presentation</H>
          {!confirm ? (
            <button type="button" onClick={() => setConfirm(true)} className="rounded border border-amber-400/60 px-2 py-1 text-[11px] text-amber-200">Reset environment…</button>
          ) : (
            <div className="rounded border border-amber-400/40 bg-amber-400/10 p-2 text-[11px] text-amber-100">
              Clears scenario runs, alerts, event history and parameter edits, and restores default layers.
              <div className="mt-1.5 flex gap-2">
                <button type="button" onClick={() => { resetEnvironment(); setConfirm(false); }} className="rounded bg-amber-500 px-2 py-1 font-semibold text-ink-950">Reset environment</button>
                <button type="button" onClick={() => setConfirm(false)} className="rounded border border-line px-2 py-1 text-slate-200">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function SettingsPanel() {
  const open = useApp(s => s.ui.settings);
  const setUi = useApp(s => s.setUi);
  const dataMode = useApp(s => s.dataMode);
  const setDataMode = useApp(s => s.setDataMode);
  const reducedMotion = useApp(s => s.reducedMotion);
  const setReducedMotion = useApp(s => s.setReducedMotion);
  const sound = useApp(s => s.settings.soundEnabled);
  const setSound = useApp(s => s.setSoundEnabled);
  const role = useApp(s => s.role);
  const canSwitch = useCan('dataMode.switch');
  const canConfig = useCan('config.edit');
  const canDiag = useCan('diagnostics.view');
  const scenarioIdle = useApp(s => s.machine.phase === 'IDLE' && s.machine.stepIndex === 0);
  if (!open) return null;
  return (
    <div role="dialog" aria-label="Settings" className="glass scroll-thin pointer-events-auto absolute top-14 right-3 z-40 max-h-[80vh] w-[22rem] overflow-y-auto rounded-xl p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Settings</h2>
        <button type="button" onClick={() => setUi({ settings: false })} aria-label="Close settings" className="text-slate-400 hover:text-white">✕</button>
      </div>
      <fieldset className="space-y-1.5" disabled={!canSwitch}>
        <legend className="mb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Data mode</legend>
        {(['MOCK', 'LIVE'] as const).map(m => (
          <label key={m} className="flex items-start gap-2 text-xs text-slate-200">
            <input type="radio" name="mode" checked={dataMode === m} disabled={m === 'LIVE' && !ENV.realDataAvailable} onChange={() => setDataMode(m)} className="mt-0.5" />
            <span>
              <strong>{m === 'MOCK' ? 'Simulation' : 'Real data'}</strong>
              <span className="block text-[11px] text-slate-400">
                {m === 'MOCK'
                  ? 'Deterministic demo fixtures — repeatable presentation (all values tagged SIMULATION).'
                  : !ENV.realDataAvailable
                    ? 'Not available on this static deployment: real feeds need the /api proxy (set VITE_API_BASE).'
                    : 'Live METAR weather, ADS-B aircraft, and roads/flights where keys are configured. Values without a live source are estimates (hover to see).'}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {!canSwitch && <p className="mt-1 text-[10px] text-slate-500">{roleLabel(role)} cannot change the mode (Administrator / Demo Operator only).</p>}
      {canSwitch && !scenarioIdle && <p className="mt-1 text-[10px] text-stale">Switching mode resets the active scenario to baseline.</p>}

      <H>Display & notifications</H>
      <label className="flex items-center gap-2 text-xs text-slate-200">
        <input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} />
        Reduce motion (pauses aircraft, static highlights)
      </label>
      <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-200">
        <input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} />
        Alert sound (one chime per new alert)
        {sound && <button type="button" onClick={playChime} className="ml-auto text-[11px] text-accent hover:underline">Test</button>}
      </label>
      <p className="mt-1 text-[10px] text-slate-500">No e-mail, SMS or push notifications are sent. Roles are a demo selector, not production security.</p>

      {canConfig && <AdminConfig />}
      {canDiag && <Diagnostics />}

      <p className="mt-4 border-t border-line pt-2 font-mono text-[10px] text-slate-500">Build {ENV.buildLabel} · {dataMode === 'MOCK' ? 'Simulation mode' : 'Real data mode'}</p>
    </div>
  );
}
