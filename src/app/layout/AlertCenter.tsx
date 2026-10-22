/**
 * Bottom decision-support card (spec §4.5, §9): collapsed banner with severity + title +
 * acknowledge; expanded view with observation, impact, factors, recommendations, assumptions,
 * provenance and role-gated actions. One-time entry animation, no continuous flashing.
 */
import { useState } from 'react';
import { istDateTime } from '../format';
import { StatusTag } from '../../components/StatusTag';
import { ENTITY_NAMES } from '../../map/EntityRegistry';
import { SIMULATION_BANNER } from '../../simulation/alertRules';
import { useApp, useCan } from '../../state/store';
import type { AlertSeverity, RecommendationAlert } from '../../types/alerts';

const SEV: Record<AlertSeverity, { cls: string; glyph: string }> = {
  INFO: { cls: 'border-sky-400/50 text-sky-300', glyph: 'ℹ' },
  WARNING: { cls: 'border-amber-400/60 text-amber-300', glyph: '▲' },
  HIGH: { cls: 'border-orange-400/70 text-orange-300', glyph: '▲' },
  CRITICAL: { cls: 'border-red-500/70 text-red-300', glyph: '⬢' },
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[10px] font-semibold tracking-[0.1em] text-slate-400 uppercase">{title}</h3>
      <div className="text-xs leading-relaxed text-slate-200">{children}</div>
    </div>
  );
}

function AlertActions({ a }: { a: RecommendationAlert }) {
  const setStatus = useApp(s => s.setAlertStatus);
  const assign = useApp(s => s.assignAlert);
  const addNote = useApp(s => s.addNote);
  const select = useApp(s => s.select);
  const focus = useApp(s => s.focus);
  const setUi = useApp(s => s.setUi);
  const canAck = useCan('alert.acknowledge');
  const canNote = useCan('alert.note');
  const canAssign = useCan('alert.assign');
  const canResolve = useCan('alert.resolve');
  const [owner, setOwner] = useState('');
  const [note, setNote] = useState('');
  const btn = 'rounded border border-line px-2.5 py-1 text-xs text-slate-200 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40';
  const closed = a.status === 'RESOLVED' || a.status === 'DISMISSED';
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => { select(a.entityIds[0]); focus(a.entityIds[0]); }}>View on map</button>
        {canAck && <button type="button" className={btn} disabled={a.status !== 'NEW'} onClick={() => setStatus(a.alertId, 'ACKNOWLEDGED')}>Acknowledge</button>}
        {canResolve && <button type="button" className={btn} disabled={closed} onClick={() => setStatus(a.alertId, 'RESOLVED')}>Resolve</button>}
        {canResolve && <button type="button" className={btn} disabled={closed} onClick={() => setStatus(a.alertId, 'DISMISSED')}>Dismiss</button>}
        <button type="button" className={btn} onClick={() => setUi({ history: true })}>Event history</button>
      </div>
      {canAssign && !closed && (
        <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); assign(a.alertId, owner); setOwner(''); }}>
          <label className="sr-only" htmlFor={`owner-${a.alertId}`}>Assign owner</label>
          <input id={`owner-${a.alertId}`} value={owner} onChange={e => setOwner(e.target.value)} placeholder="Assign owner (e.g. Landside duty manager)" className="min-w-0 flex-1 rounded border border-line bg-ink-900 px-2 py-1 text-xs text-slate-100" />
          <button type="submit" className={btn} disabled={!owner.trim()}>Assign</button>
        </form>
      )}
      {canNote && (
        <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); addNote(a.alertId, note); setNote(''); }}>
          <label className="sr-only" htmlFor={`note-${a.alertId}`}>Add note</label>
          <input id={`note-${a.alertId}`} value={note} onChange={e => setNote(e.target.value)} placeholder="Add operator note" className="min-w-0 flex-1 rounded border border-line bg-ink-900 px-2 py-1 text-xs text-slate-100" />
          <button type="submit" className={btn} disabled={!note.trim()}>Add note</button>
        </form>
      )}
      {!canAck && !canAssign && <p className="text-[10px] text-slate-500">Your role can view this alert but not act on it.</p>}
      <p className="text-[10px] text-slate-500">Status, owner and notes are kept for this browser session only (no backend configured).</p>
    </div>
  );
}

export function AlertCenter() {
  const alert = useApp(s => s.alerts.find(a => !a.archived) ?? null);
  const expanded = useApp(s => s.ui.alertExpanded);
  const setUi = useApp(s => s.setUi);
  const setStatus = useApp(s => s.setAlertStatus);
  const canAck = useCan('alert.acknowledge');
  if (!alert) return null;
  const sev = SEV[alert.severity];

  return (
    <section
      aria-label="Active recommendation"
      data-hover-scope
      role="region"
      className="alert-enter glass pointer-events-auto absolute right-3 bottom-3 left-3 z-[25] mx-auto max-w-3xl rounded-xl shadow-2xl lg:right-[25rem] lg:left-[22rem]"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${sev.cls}`}>
          <span aria-hidden="true">{sev.glyph}</span>{alert.severity}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{alert.title}</p>
          <p className="truncate text-[11px] text-slate-400">{alert.origin === 'SCENARIO' ? 'Scenario-generated' : 'Live rule'} · {alert.status} · {istDateTime(alert.createdAt)}</p>
        </div>
        <StatusTag state="SIMULATION" />
        {canAck && alert.status === 'NEW' && (
          <button type="button" onClick={() => setStatus(alert.alertId, 'ACKNOWLEDGED')} className="rounded bg-amber-500 px-2.5 py-1 text-xs font-semibold text-ink-950 hover:bg-amber-400">Acknowledge</button>
        )}
        <button type="button" data-tour="alert" aria-expanded={expanded} onClick={() => setUi({ alertExpanded: !expanded })} className="rounded border border-line px-2.5 py-1 text-xs text-slate-200 hover:border-slate-400">
          {expanded ? 'Collapse' : 'View details'}
        </button>
      </div>
      {expanded && (
        <div className="scroll-thin max-h-[52vh] overflow-y-auto border-t border-line px-4 py-3">
          <p className="mb-3 rounded border border-sim/40 bg-sim/10 px-2 py-1 text-[11px] font-semibold tracking-wide text-sim">{SIMULATION_BANNER}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Block title="Observation">{alert.observation}</Block>
            <Block title="Estimated impact">{alert.impact}</Block>
            <Block title="Contributing factors"><ul className="list-disc space-y-0.5 pl-4">{alert.contributingFactors.map(f => <li key={f}>{f}</li>)}</ul></Block>
            <Block title="Suggested actions — for operator review, not executed">
              <ol className="list-decimal space-y-0.5 pl-4">{alert.recommendations.map(r => <li key={r}>{r}</li>)}</ol>
            </Block>
            <Block title="Assumptions & limitations"><ul className="list-disc space-y-0.5 pl-4 text-slate-300">{alert.assumptions.map(a => <li key={a}>{a}</li>)}</ul></Block>
            <div className="space-y-3">
              <Block title="Data provenance">
                <ul className="space-y-1">
                  {alert.sourceStates.map(s => (
                    <li key={s.input} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-slate-300">{s.input}</span><StatusTag state={s.state} />
                      <span className="text-[10px] text-slate-500">{s.sourceLabel} · {istDateTime(s.observedAt)}</span>
                    </li>
                  ))}
                </ul>
              </Block>
              <Block title="Affected entities">{alert.entityIds.map(id => ENTITY_NAMES[id] ?? id).join(' · ')}</Block>
              {alert.owner && <Block title="Owner">{alert.owner}</Block>}
              {alert.notes.length > 0 && (
                <Block title="Notes"><ul className="space-y-0.5">{alert.notes.map(n => <li key={n.at}><span className="text-slate-500">{istDateTime(n.at)} · {n.by}:</span> {n.text}</li>)}</ul></Block>
              )}
            </div>
          </div>
          <div className="mt-3 border-t border-line pt-3"><AlertActions a={alert} /></div>
        </div>
      )}
    </section>
  );
}
