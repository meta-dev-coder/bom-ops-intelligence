import type { ReactNode } from 'react';
import type { DataState } from '../types/telemetry';
import { InfoTip } from './InfoTip';
import { StatusTag } from './StatusTag';

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  state: DataState;
  definition: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'warn' | 'crit' | 'ok';
  baseline?: ReactNode;
}

const TONE = { default: 'text-white', ok: 'text-live', warn: 'text-warn', crit: 'text-crit' };

/** Every KPI shows unit, state tag and a definition (FR-04). */
export function KpiCard({ label, value, unit, state, definition, sub, tone = 'default', baseline }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-line bg-ink-850/70 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] leading-tight font-medium text-slate-400">{label}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <StatusTag state={state} />
          <InfoTip label={`What is ${label}?`}>{definition}</InfoTip>
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`tabular text-2xl font-semibold tracking-tight ${TONE[tone]}`}>{value}</span>
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
      </div>
      {baseline && <div className="tabular mt-0.5 text-[11px] text-slate-400">Baseline {baseline}</div>}
      {sub && <div className="mt-1 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
