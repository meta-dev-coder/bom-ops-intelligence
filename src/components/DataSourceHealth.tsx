import { useState } from 'react';
import { istTime } from '../app/format';
import { useApp, useCan } from '../state/store';
import { Section } from './Panel';
import { StatusTag } from './StatusTag';

/** FR-14: provider, state, last success/attempt and fallback — never a secret. */
export function DataSourceHealth() {
  const health = useApp(s => s.providerHealth);
  const layerStatus = useApp(s => s.layerStatus);
  const diagnostics = useCan('diagnostics.view');
  const [open, setOpen] = useState(false);
  const layerIssues = Object.entries(layerStatus).filter(([, v]) => v?.state === 'error');
  return (
    <Section
      title="Data sources"
      id="h-sources"
      right={<button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="text-[11px] text-accent hover:underline">{open ? 'Less' : 'Details'}</button>}
    >
      <ul className="space-y-1">
        {health.map(p => (
          <li key={p.providerId} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-slate-300">{p.label}</span>
              <StatusTag state={p.state} />
            </div>
            {open && (
              <div className="mt-0.5 mb-1 pl-2 text-[10px] leading-snug text-slate-500">
                {p.lastSuccessAt && <>Last success {istTime(p.lastSuccessAt)} · </>}
                {p.lastAttemptAt && <>Last attempt {istTime(p.lastAttemptAt)} · </>}
                {p.note}
                {p.error && diagnostics && <span className="text-stale"> · {p.error}</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {layerIssues.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[10px] text-stale">
          {layerIssues.map(([k, v]) => <li key={k}>Map layer degraded: {v?.message ?? k}</li>)}
        </ul>
      )}
    </Section>
  );
}
