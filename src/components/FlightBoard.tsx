import { etaFrom, num } from '../app/format';
import { estimatedPassengers } from '../simulation/operationalState';
import { ENTITY_NAMES } from '../map/EntityRegistry';
import type { DataEnvelope, FlightRecord } from '../types/telemetry';
import { InfoTip } from './InfoTip';
import { Section } from './Panel';
import { StatusTag } from './StatusTag';

const CAT: Record<FlightRecord['aircraftCategory'], string> = { WIDEBODY: 'Widebody', NARROWBODY: 'Narrowbody', REGIONAL: 'Regional' };

export function FlightBoard({ env, windowStart, highlightTerminal }: { env: DataEnvelope<FlightRecord[]>; windowStart: string; highlightTerminal?: string | null }) {
  const rows = [...env.data].sort((a, b) => a.etaOffsetMinutes - b.etaOffsetMinutes).slice(0, 5);
  return (
    <Section
      title="Upcoming arrivals"
      id="h-flights"
      right={<span className="flex items-center gap-1.5"><StatusTag state={env.state} /><InfoTip>Synthetic demo rows (flight numbers prefixed DEMO). Not an actual schedule. Passengers = seats × assumed load factor.</InfoTip></span>}
    >
      <table className="w-full text-xs">
        <caption className="sr-only">Top five upcoming synthetic arrivals</caption>
        <thead>
          <tr className="text-left text-[10px] tracking-wide text-slate-500 uppercase">
            <th className="pb-1 font-medium">Flight</th><th className="pb-1 font-medium">From</th>
            <th className="pb-1 font-medium">ETA</th><th className="pb-1 text-right font-medium">Pax (est.)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(f => (
            <tr key={f.id} className={`border-t border-line/60 ${highlightTerminal === f.terminalId ? 'bg-accent/5' : ''}`}>
              <td className="py-1">
                <div className="font-mono text-[11px] text-slate-100">{f.flightNumber}</div>
                <div className="text-[10px] text-slate-500">{CAT[f.aircraftCategory]} · {ENTITY_NAMES[f.terminalId]?.replace('Terminal ', 'T')}</div>
              </td>
              <td className="py-1 text-slate-300">{f.origin ?? '—'}</td>
              <td className="tabular py-1 text-slate-300">{etaFrom(windowStart, f.etaOffsetMinutes).replace(' IST', '')}</td>
              <td className="tabular py-1 text-right text-slate-100">{num(estimatedPassengers(f))}<span className="text-slate-500">/{f.seatsAssumed}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
