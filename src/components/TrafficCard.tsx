import { num } from '../app/format';
import { ROAD_COLORS } from '../map/colors';
import { useApp } from '../state/store';
import type { DataEnvelope, RoadStatus, TrafficSegment } from '../types/telemetry';
import { Section } from './Panel';
import { StatusTag } from './StatusTag';

export const STATUS_LABEL: Record<RoadStatus, string> = {
  FREE_FLOW: 'Free flow', MODERATE: 'Moderate', HEAVY: 'Heavy', SEVERE: 'Severe', BLOCKED: 'Blocked / severe',
};

export function travelTimeRatio(seg: TrafficSegment): number | null {
  if (!seg.freeFlowSpeedKmh || seg.currentSpeedKmh <= 0) return null;
  // (length/current) ÷ (length/free-flow) — computed from travel times, not inverted speeds (§6).
  return (seg.lengthM / seg.currentSpeedKmh) / (seg.lengthM / seg.freeFlowSpeedKmh);
}

export function TrafficCard({ segments }: { segments: DataEnvelope<TrafficSegment>[] }) {
  const select = useApp(s => s.select);
  const focus = useApp(s => s.focus);
  return (
    <Section title="Landside traffic" id="h-traffic">
      <ul className="space-y-2">
        {segments.map(env => {
          const t = env.data;
          const ttr = travelTimeRatio(t);
          return (
            <li key={t.id}>
              <button
                type="button"
                data-tour={t.id}
                onClick={() => { select(t.id); focus(t.id); }}
                className="w-full rounded-md border border-line bg-ink-850/60 p-2 text-left hover:border-accent/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-slate-100">{t.name}</span>
                  <StatusTag state={env.state} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="inline-block h-1.5 w-6 rounded" style={{ background: ROAD_COLORS[t.status] }} aria-hidden="true" />
                  <span className="font-semibold" style={{ color: ROAD_COLORS[t.status] }}>{STATUS_LABEL[t.status]}</span>
                  <span className="tabular ml-auto text-slate-200">{num(t.currentSpeedKmh)} <span className="text-slate-400">/ {t.freeFlowSpeedKmh ?? '—'} km/h</span></span>
                </div>
                <div className="tabular mt-0.5 text-[10px] text-slate-500">
                  Travel-time ratio {ttr == null ? '—' : `×${num(ttr, 1)}`} · {new Date(env.observedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })} IST · {env.sourceLabel}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
