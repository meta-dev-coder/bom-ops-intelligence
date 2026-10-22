import { useState } from 'react';
import { num } from '../app/format';
import { roleLabel } from '../config/roles';
import { SCENARIO_MONSOON } from '../data/MockDataService';
import { applyDraft, BAND_FIELDS, EDITABLE_FIELDS, toDraft, type Draft, type EditableKey } from '../simulation/assumptionEdits';
import { DEFAULT_ASSUMPTIONS } from '../simulation/demandPressure';
import { useApp, useCan, useOperational } from '../state/store';
import { Row, Section } from './Panel';
import { StatusTag } from './StatusTag';

const PHASE_TEXT = { IDLE: 'Baseline', RUNNING: 'Running…', ACTIVE: 'Scenario active', RESETTING: 'Resetting…', ERROR: 'Error' } as const;

function AssumptionsEditor() {
  const assumptions = useApp(s => s.assumptions);
  const setAssumptions = useApp(s => s.setAssumptions);
  const idle = useApp(s => s.machine.phase === 'IDLE');
  const [draft, setDraft] = useState<Draft>(() => toDraft(assumptions));
  const [errors, setErrors] = useState<Partial<Record<EditableKey, string>>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(assumptions));
  const apply = () => {
    const r = applyDraft(assumptions, draft);
    if (r.ok) { setErrors({}); setAssumptions(r.value); } else setErrors(r.errors);
  };
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-slate-300">Edit approved parameters & thresholds (Supervisor)</summary>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {EDITABLE_FIELDS.map(f => (
          <label key={f.key} className="flex flex-col gap-0.5 text-[11px] text-slate-400">
            {f.label}
            <input
              type="number" inputMode="decimal" step={f.step} min={f.min} max={f.max} disabled={!idle}
              value={draft[f.key]}
              aria-invalid={Boolean(errors[f.key])}
              aria-describedby={errors[f.key] ? `err-${f.key}` : undefined}
              onChange={ev => setDraft({ ...draft, [f.key]: ev.target.value })}
              className={`tabular rounded border bg-ink-900 px-2 py-1 text-slate-100 disabled:opacity-50 ${errors[f.key] ? 'border-crit' : 'border-line'}`}
            />
            {errors[f.key] && <span id={`err-${f.key}`} className="text-[10px] text-crit">{errors[f.key]}</span>}
          </label>
        ))}
      </div>
      <p className="mt-3 mb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Index band thresholds (Low starts at 0)</p>
      <div className="grid grid-cols-3 gap-2">
        {BAND_FIELDS.map(f => (
          <label key={f.key} className="flex flex-col gap-0.5 text-[11px] text-slate-400">
            {f.label}
            <input
              type="number" inputMode="numeric" step={1} min={1} max={100} disabled={!idle}
              value={draft[f.key]}
              aria-invalid={Boolean(errors[f.key])}
              aria-describedby={errors[f.key] ? `err-${f.key}` : undefined}
              onChange={ev => setDraft({ ...draft, [f.key]: ev.target.value })}
              className={`tabular rounded border bg-ink-900 px-2 py-1 text-slate-100 disabled:opacity-50 ${errors[f.key] ? 'border-crit' : 'border-line'}`}
            />
            {errors[f.key] && <span id={`err-${f.key}`} className="text-[10px] text-crit">{errors[f.key]}</span>}
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={!dirty || !idle} onClick={apply} className="rounded bg-accent/90 px-2 py-1 text-[11px] font-semibold text-ink-950 disabled:opacity-40">Apply</button>
        <button type="button" disabled={!idle} onClick={() => { setErrors({}); setDraft(toDraft(DEFAULT_ASSUMPTIONS)); setAssumptions(DEFAULT_ASSUMPTIONS); }} className="rounded border border-line px-2 py-1 text-[11px] text-slate-300 disabled:opacity-40">Restore defaults</button>
      </div>
      {!idle && <p className="mt-1 text-[10px] text-slate-500">Reset the scenario to change parameters.</p>}
    </details>
  );
}

export function ScenarioControls() {
  const machine = useApp(s => s.machine);
  const run = useApp(s => s.runScenario);
  const reset = useApp(s => s.resetScenario);
  const role = useApp(s => s.role);
  const canRun = useCan('scenario.run');
  const canEdit = useCan('assumptions.edit');
  const { current, baseline } = useOperational();
  const steps = SCENARIO_MONSOON.steps;
  const t2 = current.terminals[SCENARIO_MONSOON.targetEntityId];
  const t2b = baseline.terminals[SCENARIO_MONSOON.targetEntityId];
  const road = current.traffic[SCENARIO_MONSOON.roadEntityId]?.data;
  const roadB = baseline.traffic[SCENARIO_MONSOON.roadEntityId]?.data;

  return (
    <Section title="Scenario A" id="h-scenario" right={<span className="text-[11px] text-slate-400" aria-live="polite">{PHASE_TEXT[machine.phase]}</span>}>
      <p className="text-sm font-medium text-slate-100">{SCENARIO_MONSOON.name}</p>
      <p className="mb-2 text-[11px] text-slate-500">v{SCENARIO_MONSOON.version} · scripted, deterministic · <StatusTag state="SIMULATION" /></p>

      <div className="flex gap-2">
        <button
          type="button"
          data-tour="run-scenario"
          onClick={run}
          disabled={!canRun || machine.phase !== 'IDLE'}
          title={!canRun ? `${roleLabel(role)} cannot run scenarios` : undefined}
          className="flex-1 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {machine.phase === 'RUNNING' ? 'Running…' : 'Run scenario'}
        </button>
        <button
          type="button"
          data-tour="reset-scenario"
          onClick={reset}
          disabled={!canRun || (machine.phase === 'IDLE' && machine.stepIndex === 0)}
          className="rounded-md border border-line px-3 py-2 text-sm text-slate-200 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      {!canRun && <p className="mt-1 text-[10px] text-slate-500">Your role ({roleLabel(role)}) can view outcomes but not run scenarios.</p>}

      <ol className="mt-3 space-y-1" aria-label="Scenario steps">
        {steps.map((s, i) => {
          const done = i < machine.stepIndex;
          const now = machine.phase === 'RUNNING' && i === machine.stepIndex;
          return (
            <li key={s.id} className="flex items-start gap-2 text-xs">
              <span aria-hidden="true" className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[9px] ${done ? 'border-amber-400 bg-amber-400 text-ink-950' : now ? 'border-amber-400 text-amber-300' : 'border-slate-600 text-slate-500'}`}>{done ? '✓' : i + 1}</span>
              <span className={done ? 'text-slate-200' : 'text-slate-500'}>
                <strong className="font-medium">{s.label}</strong> — {s.description}
                <span className="sr-only">{done ? ' (done)' : now ? ' (in progress)' : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {machine.phase === 'ERROR' && <p className="mt-2 text-xs text-crit">Scenario error: {machine.error}. Reset to restore baseline.</p>}

      {machine.stepIndex > 0 && t2 && t2b && (
        <div className="mt-3 rounded-md border border-line bg-ink-850/60 p-2">
          <p className="mb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Baseline vs scenario</p>
          <Row k="T2 Demand Pressure Index" v={<>{t2b.pressure.index} → <strong className={t2.pressure.band === 'Severe' ? 'text-crit' : 'text-white'}>{t2.pressure.index}</strong> <span className="text-slate-400">({t2.pressure.band})</span></>} />
          <Row k="Rainfall" v={`${num(baseline.weather.data.precipitationMmPerHour, 1)} → ${num(current.weather.data.precipitationMmPerHour, 1)} mm/h`} />
          {road && roadB && <Row k="Sahar inbound speed" v={`${num(roadB.currentSpeedKmh)} → ${num(road.currentSpeedKmh)} km/h`} />}
          <Row k="Effective forecourt capacity" v={`${num(t2b.pressure.effectiveCapacityVehicles)} → ${num(t2.pressure.effectiveCapacityVehicles)} veh`} />
          {!current.impactApplied && <p className="mt-1 text-[10px] text-slate-500">KPIs update at the Impact step.</p>}
        </div>
      )}
      {canEdit && <AssumptionsEditor />}
    </Section>
  );
}
