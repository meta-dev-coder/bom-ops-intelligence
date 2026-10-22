/**
 * Start tile + guided presenter flow (pattern from acs-demo: cesium-poc uc1Mode.js startup tile
 * and stepper, root GuidedTour.tsx Skip/Back/Next coach card). Everything is skippable: the tile
 * offers "Explore on my own", every step has Skip tour, and the top bar's Guide button relaunches it.
 */
import { useEffect, useMemo, useRef } from 'react';
import { SCENARIO_MONSOON } from '../data/MockDataService';
import { useApp } from '../state/store';
import { DEMO_SEEN_KEY, DEMO_STEPS, isStepDone, shouldShowStartTile, type DemoAction } from './demoFlow';

const markSeen = () => {
  try { localStorage.setItem(DEMO_SEEN_KEY, '1'); } catch { /* storage blocked: tile simply shows again */ }
};

function useDemoSnapshot() {
  const selectedEntityId = useApp(s => s.selectedEntityId);
  const phase = useApp(s => s.machine.phase);
  const stepIndex = useApp(s => s.machine.stepIndex);
  const alertExpanded = useApp(s => s.ui.alertExpanded);
  const hasActiveAlert = useApp(s => s.alerts.some(a => !a.archived));
  const hasArchivedAlert = useApp(s => s.alerts.some(a => a.archived));
  return useMemo(
    () => ({ selectedEntityId, phase, stepIndex, alertExpanded, hasActiveAlert, hasArchivedAlert }),
    [selectedEntityId, phase, stepIndex, alertExpanded, hasActiveAlert, hasArchivedAlert],
  );
}

function perform(action: DemoAction) {
  const s = useApp.getState();
  switch (action) {
    case 'selectT2': s.select(SCENARIO_MONSOON.targetEntityId); s.focus(SCENARIO_MONSOON.targetEntityId); break;
    case 'selectRoad': s.select(SCENARIO_MONSOON.roadEntityId); s.focus(SCENARIO_MONSOON.roadEntityId); break;
    case 'runScenario': s.runScenario(); break;
    case 'openAlert': s.setUi({ alertExpanded: true }); break;
    case 'resetScenario': s.resetScenario(); break;
  }
}

/** Spotlights the step's target element (any element carrying a matching data-tour attribute). */
function useSpotlight(target: string | undefined) {
  useEffect(() => {
    if (!target) return;
    let els: Element[] = [];
    const apply = () => {
      els.forEach(e => e.classList.remove('tour-target'));
      els = [...document.querySelectorAll(`[data-tour~="${target}"]`)];
      els.forEach(e => e.classList.add('tour-target'));
    };
    apply();
    // Targets such as the alert card mount later; re-apply when the DOM changes.
    const mo = new MutationObserver(apply);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); els.forEach(e => e.classList.remove('tour-target')); };
  }, [target]);
}

function StartTile() {
  const startGuidedDemo = useApp(s => s.startGuidedDemo);
  const setDemo = useApp(s => s.setDemo);
  const explore = () => { markSeen(); setDemo({ mode: 'off' }); };
  return (
    <div className="pointer-events-auto absolute inset-0 z-[45] grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="start-title">
      <div className="glass w-full max-w-xl rounded-2xl p-7 shadow-2xl">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-accent uppercase">Mumbai Airport (BOM) · Operations Intelligence PoC</p>
        <h1 id="start-title" className="mt-2 text-2xl leading-tight font-semibold text-white">Monsoon squall meets the evening arrivals peak</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          “Heavy rain, a blocked Sahar approach and four widebodies landing in the next half hour — how much pressure does that put on the T2 forecourt, and what should we review?”
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-line px-2.5 py-1 text-slate-300">~4 min · 6 steps</span>
          <span className="rounded-full border border-sim/40 bg-sim/10 px-2.5 py-1 text-sim">◆ All data is SIMULATION</span>
          <span className="rounded-full border border-line px-2.5 py-1 text-slate-300">Repeatable · resets exactly</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" autoFocus onClick={() => { markSeen(); startGuidedDemo(); }} className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-amber-400">
            Start the guided demo
          </button>
          <button type="button" onClick={explore} className="rounded-lg border border-line px-4 py-2.5 text-sm text-slate-200 hover:border-slate-400">
            Skip — explore on my own
          </button>
        </div>
        <p className="mt-4 text-[11px] text-slate-500">You can reopen the guide any time from <strong className="text-slate-400">Guide</strong> in the top bar. Decision-support demonstration — not an operational airport system.</p>
      </div>
    </div>
  );
}

function GuidedCard() {
  const step = useApp(s => s.demo.step);
  const setDemo = useApp(s => s.setDemo);
  const snap = useDemoSnapshot();
  const current = DEMO_STEPS[step];
  const done = current ? isStepDone(current, snap) : false;
  const last = step === DEMO_STEPS.length - 1;
  useSpotlight(current?.target);

  // When the user completes the step themselves, move on (once per step).
  const advancedFrom = useRef<number | null>(null);
  useEffect(() => {
    if (!done || last || advancedFrom.current === step) return;
    advancedFrom.current = step;
    const id = setTimeout(() => setDemo({ step: step + 1 }), 900);
    return () => clearTimeout(id);
  }, [done, last, step, setDemo]);

  if (!current) return null;
  const finish = () => setDemo({ mode: 'off', step: 0 });

  return (
    <div className="pointer-events-none absolute top-14 right-0 left-0 z-[35] flex justify-center px-3 lg:right-[25rem] lg:left-[22rem]">
      <section aria-live="polite" aria-label="Guided demo" className="glass pointer-events-auto w-full max-w-lg rounded-xl border-accent/40 p-4 shadow-2xl">
        <ol className="mb-3 flex flex-wrap items-center gap-1" aria-label="Demo steps">
          {DEMO_STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setDemo({ step: i })}
                aria-current={i === step ? 'step' : undefined}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${i < step ? 'bg-accent/20 text-accent' : i === step ? 'bg-amber-500 text-ink-950' : 'bg-ink-800 text-slate-500'}`}
              >
                {i + 1} {s.label}
              </button>
            </li>
          ))}
        </ol>
        <h2 className="text-base font-semibold text-white">{current.title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{current.body}</p>
        {current.instruction && (
          <p className={`mt-2 rounded-md border px-2.5 py-1.5 text-xs ${done ? 'border-live/40 bg-live/10 text-live' : 'border-amber-400/40 bg-amber-400/10 text-amber-200'}`}>
            {done ? '✓ Done' : `→ ${current.instruction}`}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={finish} className="text-xs text-slate-400 hover:text-white">Skip tour</button>
          <span className="flex-1" />
          {step > 0 && <button type="button" onClick={() => setDemo({ step: step - 1 })} className="rounded-md border border-line px-3 py-1.5 text-xs text-slate-200">Back</button>}
          {current.action && !done && (
            <button type="button" onClick={() => perform(current.action!)} className="rounded-md border border-amber-400/60 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/10">
              {current.actionLabel}
            </button>
          )}
          <button type="button" onClick={() => (last ? finish() : setDemo({ step: step + 1 }))} className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-ink-950">
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </section>
    </div>
  );
}

export function DemoTour() {
  const mode = useApp(s => s.demo.mode);
  const setDemo = useApp(s => s.setDemo);
  useEffect(() => {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* blocked */ }
    if (shouldShowStartTile(window.location.search, storage)) setDemo({ mode: 'start' });
  }, [setDemo]);
  if (mode === 'start') return <StartTile />;
  if (mode === 'guided') return <GuidedCard />;
  return null;
}
