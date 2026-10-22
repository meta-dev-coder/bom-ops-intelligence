import type { ReactNode } from 'react';

export function Section({ title, right, children, id }: { title: string; right?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section data-hover-scope aria-labelledby={id} className="border-b border-line px-3.5 py-3 last:border-b-0">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 id={id} className="text-[11px] font-semibold tracking-[0.08em] text-slate-300 uppercase">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

export function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
      <span className="text-slate-400">{k}</span>
      <span className="tabular text-right text-slate-100">{v}</span>
    </div>
  );
}

export function Freshness({ label, observedAt, quality }: { label: string; observedAt: string; quality?: string }) {
  return (
    <p className="mt-2 text-[10px] leading-snug text-slate-500">
      {label} · {new Date(observedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', hour12: false })} IST
      {quality ? ` · ${quality}` : ''}
    </p>
  );
}
