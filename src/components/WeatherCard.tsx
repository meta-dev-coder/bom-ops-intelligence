import { compass, num } from '../app/format';
import { heavyRainThreshold } from '../simulation/demandPressure';
import { useApp } from '../state/store';
import type { DataEnvelope, WeatherRecord } from '../types/telemetry';
import { Freshness, Section } from './Panel';
import { StatusTag } from './StatusTag';

const KIND_NOTE: Record<WeatherRecord['kind'], string> = {
  OBSERVATION: 'Station observation',
  MODEL: 'Model nowcast — not a station observation',
  FIXTURE: 'Illustrative evening baseline',
  SCRIPTED: 'Scripted scenario input — not a forecast',
};

export function WeatherCard({ env }: { env: DataEnvelope<WeatherRecord> }) {
  const w = env.data;
  const heavyAt = useApp(s => heavyRainThreshold(s.assumptions));
  const heavy = w.precipitationMmPerHour >= heavyAt;
  return (
    <Section title="Weather · BOM" id="h-weather" right={<StatusTag state={env.state} />}>
      <div className="flex items-end justify-between">
        <div>
          <div className="tabular text-3xl font-semibold text-white">{num(w.temperatureC)}<span className="text-base text-slate-400">°C</span></div>
          <div className="text-xs text-slate-300">{w.condition}</div>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right text-xs">
          <dt className="text-slate-400">Rainfall</dt>
          <dd className={`tabular font-semibold ${heavy ? 'text-crit' : 'text-slate-100'}`}>{num(w.precipitationMmPerHour, 1)} mm/h</dd>
          <dt className="text-slate-400">Wind</dt>
          <dd className="tabular text-slate-100">{num(w.windSpeedKmh)} km/h {compass(w.windDirectionDeg)}</dd>
        </dl>
      </div>
      <Freshness label={env.sourceLabel} observedAt={env.observedAt} quality={KIND_NOTE[w.kind]} />
      {env.errorCode && <p className="mt-1 text-[10px] text-stale">Fallback: {env.errorCode}</p>}
    </Section>
  );
}
