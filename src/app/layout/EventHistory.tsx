import { useApp } from '../../state/store';
import { istDateTime } from '../format';

export function EventHistory() {
  const open = useApp(s => s.ui.history);
  const events = useApp(s => s.events);
  const alerts = useApp(s => s.alerts);
  const setUi = useApp(s => s.setUi);
  if (!open) return null;
  return (
    <div role="dialog" aria-label="Event history" className="glass pointer-events-auto absolute top-14 right-3 z-40 flex max-h-[70vh] w-96 flex-col rounded-xl shadow-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Event history <span className="font-normal text-slate-500">(this session)</span></h2>
        <button type="button" onClick={() => setUi({ history: false })} aria-label="Close history" className="text-slate-400 hover:text-white">✕</button>
      </div>
      <div className="scroll-thin overflow-y-auto px-4 py-3">
        {alerts.length > 0 && (
          <>
            <h3 className="mb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Alerts</h3>
            <ul className="mb-3 space-y-1">
              {alerts.map(a => (
                <li key={a.alertId} className="text-xs text-slate-300">
                  <span className="font-semibold">{a.severity}</span> {a.title} — {a.status}{a.archived ? ' · archived' : ''}{a.owner ? ` · ${a.owner}` : ''}
                </li>
              ))}
            </ul>
          </>
        )}
        <h3 className="mb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Events</h3>
        {events.length === 0 ? <p className="text-xs text-slate-500">No events yet.</p> : (
          <ol className="space-y-1.5">
            {events.map(e => (
              <li key={e.id} className="text-xs">
                <div className="text-[10px] text-slate-500">{istDateTime(e.at)} · {e.actorRole} · {e.kind.replaceAll('_', ' ').toLowerCase()}</div>
                <div className="text-slate-200">{e.detail}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
