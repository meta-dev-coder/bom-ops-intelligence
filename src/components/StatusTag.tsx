import { useRealQuiet } from '../state/store';
import type { DataState } from '../types/telemetry';

type TagState = DataState | 'UNAVAILABLE' | 'DISABLED';

/** Shape + text + colour, never colour alone (spec §4.2). */
const STYLES: Record<TagState, { cls: string; glyph: string; label: string }> = {
  LIVE: { cls: 'text-live border-live/40 bg-live/10', glyph: '●', label: 'LIVE' },
  STALE: { cls: 'text-stale border-stale/40 bg-stale/10', glyph: '▲', label: 'STALE' },
  SIMULATION: { cls: 'text-sim border-sim/40 bg-sim/10', glyph: '◆', label: 'SIMULATION' },
  UNAVAILABLE: { cls: 'text-slate-400 border-slate-500/40 bg-slate-500/10', glyph: '○', label: 'UNAVAILABLE' },
  DISABLED: { cls: 'text-slate-400 border-slate-500/40 bg-slate-500/10', glyph: '–', label: 'NOT CONFIGURED' },
};

/**
 * In Real mode (with no scenario running) a value that is not from a live source is an estimate:
 * it carries no visible tag, and a neutral ESTIMATE tag appears on hover/focus of its card
 * (`data-hover-scope`). Screen readers always get the word. Scenario values stay SIMULATION.
 */
export function StatusTag({ state, title }: { state: TagState; title?: string }) {
  const realQuiet = useRealQuiet();
  if (state === 'SIMULATION' && realQuiet) {
    return (
      <span title={title ?? 'Estimate — not from a live source'} className="estimate-tag inline-flex items-center rounded border border-slate-500/40 bg-slate-500/10 px-1.5 py-px text-[10px] font-semibold tracking-wide whitespace-nowrap text-slate-300">
        ESTIMATE
      </span>
    );
  }
  const s = STYLES[state];
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-semibold tracking-wide whitespace-nowrap ${s.cls}`}>
      <span aria-hidden="true" className="text-[8px] leading-none">{s.glyph}</span>
      {s.label}
    </span>
  );
}
