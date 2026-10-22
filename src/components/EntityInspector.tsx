/**
 * Context-aware inspector (spec §4.4): title, KPIs and actions depend on the selected entity's
 * type. Nothing unrelated is shown just to fill space.
 */
import { etaFrom, num } from '../app/format';
import { FEATURES } from '../config/featureFlags';
import { SCENARIO_MONSOON } from '../data/MockDataService';
import { ENTITY_BY_ID, ENTITY_NAMES } from '../map/EntityRegistry';
import { describeAssumptions, describeBands } from '../simulation/demandPressure';
import type { OperationalState, TerminalKpis } from '../simulation/scenarioTypes';
import { useApp, useOperational } from '../state/store';
import type { AirportEntity } from '../types/entities';
import type { DataState } from '../types/telemetry';
import { KpiCard } from './KpiCard';
import { Row, Section } from './Panel';
import { STATUS_LABEL, travelTimeRatio } from './TrafficCard';

const BAND_TONE = { Low: 'ok', Moderate: 'default', High: 'warn', Severe: 'crit' } as const;

function Provenance({ e }: { e: AirportEntity }) {
  return (
    <details className="mt-2 text-[10px] leading-snug text-slate-500">
      <summary className="cursor-pointer text-slate-400">Geometry & provenance</summary>
      <p className="mt-1">{e.geometrySource}</p>
      <p>Confidence: {e.geometryConfidence} · {e.reviewStatus}</p>
    </details>
  );
}

function TerminalView({ e, k, kBase, op, scenarioActive }: { e: AirportEntity; k: TerminalKpis; kBase: TerminalKpis; op: OperationalState; scenarioActive: boolean }) {
  const assumptions = useApp(s => s.assumptions);
  const windowStart = useApp(s => (s.frozenBaseline ?? s.baseline).windowStart);
  const demandState: DataState = 'SIMULATION';
  const isT2 = e.id === 'terminal-t2';
  const changed = scenarioActive && op.impactApplied && k.pressure.index !== kBase.pressure.index;
  const pressureDef = (
    <>
      <strong>Demand Pressure Index (SIMULATION)</strong> — projected forecourt vehicle demand ÷ effective processing capacity over {assumptions.windowMinutes} min, scaled 0–100.
      Not a predicted queue time or capacity breach. Bands: {describeBands(assumptions)} (illustrative).
    </>
  );
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <KpiCard
            label={isT2 ? 'Passenger Demand / Forecourt Pressure Index' : 'Synthetic Demand Index'}
            value={k.pressure.index}
            unit={`/ 100 · ${k.pressure.band}`}
            tone={BAND_TONE[k.pressure.band]}
            state={demandState}
            definition={pressureDef}
            baseline={changed ? `${kBase.pressure.index} (${kBase.pressure.band})` : undefined}
          />
        </div>
        <KpiCard
          label={`Arrival demand (${assumptions.windowMinutes} min)`}
          value={num(k.arrivingPassengers)}
          unit="pax"
          state="SIMULATION"
          definition={<>Estimated passengers, next {assumptions.windowMinutes} min: sum of seats × assumed load factor over synthetic arrivals assigned to this terminal.</>}
        />
        <KpiCard
          label="Forecourt pressure ratio"
          value={Number.isFinite(k.pressure.pressureRatio) ? num(k.pressure.pressureRatio, 2) : '∞'}
          unit="× capacity"
          tone={k.pressure.pressureRatio > 1 ? 'warn' : 'default'}
          state="SIMULATION"
          definition={<>Projected pickup + drop-off vehicles ({num(k.pressure.projectedVehicleDemand)}) ÷ effective capacity ({num(k.pressure.effectiveCapacityVehicles)} vehicles in the window).</>}
          baseline={changed ? num(kBase.pressure.pressureRatio, 2) : undefined}
        />
        {isT2 && (
          <KpiCard
            label="Est. dispatch delay (illustrative)"
            value={k.pressure.dispatchDelayMinutes == null ? '—' : num(k.pressure.dispatchDelayMinutes)}
            unit="min"
            state="SIMULATION"
            definition={<>Illustrative rule, not a measured or predicted queue time: {assumptions.baseServiceMinutes} min base service + excess vehicles ÷ effective capacity per minute.</>}
            baseline={changed && kBase.pressure.dispatchDelayMinutes != null ? `${num(kBase.pressure.dispatchDelayMinutes)} min` : undefined}
          />
        )}
        <KpiCard
          label="Cab staging utilization"
          value={k.cabStaging.utilisationPct}
          unit="%"
          state="SIMULATION"
          sub={`${k.cabStaging.occupied} of ${k.cabStaging.capacity} positions (configured demo values)`}
          definition={<>Synthetic vehicles in staging ÷ configured staging capacity × 100. Both values are mock data, not verified airport capacity.</>}
        />
        {k.apronStands && (
          <KpiCard
            label="Apron stand occupancy"
            value={k.apronStands.occupancyPct}
            unit="%"
            state="SIMULATION"
            sub={`${k.apronStands.occupied} of ${k.apronStands.total} stands`}
            definition={<>Synthetic occupied stands ÷ configured total stands × 100. Not an actual occupancy feed.</>}
          />
        )}
      </div>

      <Section title="Contributing arrivals" id={`h-arr-${e.id}`}>
        {k.arrivalsNextWindow.length === 0 ? <p className="text-xs text-slate-400">No synthetic arrivals in the window.</p> : (
          <ul className="space-y-0.5">
            {k.arrivalsNextWindow.map(f => (
              <li key={f.id} className="flex justify-between text-xs">
                <span className="font-mono text-slate-200">{f.flightNumber} <span className="text-slate-500">{f.origin}</span></span>
                <span className="tabular text-slate-300">{etaFrom(windowStart, f.etaOffsetMinutes)} · {f.estimatedPassengers} pax</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Model working" id={`h-work-${e.id}`}>
        <Row k="Pickup vehicles" v={num(k.pressure.pickupVehicles)} />
        <Row k="Projected vehicle demand" v={num(k.pressure.projectedVehicleDemand)} />
        <Row k="Road capacity factor" v={`×${num(k.pressure.roadCapacityFactor, 2)}`} />
        <Row k="Weather capacity factor" v={`×${num(k.pressure.weatherCapacityFactor, 2)}`} />
        <Row k="Effective capacity (window)" v={`${num(k.pressure.effectiveCapacityVehicles)} veh`} />
        <details className="mt-2 text-[11px] text-slate-400">
          <summary className="cursor-pointer">Assumptions (SIMULATION)</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">{describeAssumptions(assumptions).map(a => <li key={a}>{a}</li>)}</ul>
        </details>
      </Section>
      <EntityAlertHistory e={e} />
      <AdjacentLinks e={e} />
      <Provenance e={e} />
    </>
  );
}

/** Spec §4.4: alerts that involved this entity, newest first (session history). */
function EntityAlertHistory({ e }: { e: AirportEntity }) {
  const all = useApp(s => s.alerts);
  const setUi = useApp(s => s.setUi);
  const alerts = all.filter(a => a.entityIds.includes(e.id));
  return (
    <Section title="Alert history" id={`h-alerts-${e.id}`}>
      {alerts.length === 0 ? <p className="text-xs text-slate-500">No alerts for this {e.type === 'ROAD' ? 'segment' : 'facility'} in this session.</p> : (
        <ul className="space-y-1">
          {alerts.map(a => (
            <li key={a.alertId} className="text-xs">
              <span className="font-semibold text-slate-200">{a.severity}</span> <span className="text-slate-300">{a.title}</span>
              <div className="text-[10px] text-slate-500">
                {new Date(a.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} IST · {a.status}{a.archived ? ' · archived' : ''} · {a.origin === 'SCENARIO' ? 'scenario' : 'live rule'}
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setUi({ history: true })} className="mt-1 text-[11px] text-accent hover:underline">Open event history</button>
    </Section>
  );
}

function AdjacentLinks({ e }: { e: AirportEntity }) {
  const select = useApp(s => s.select);
  const focus = useApp(s => s.focus);
  if (!e.adjacentEntityIds.length) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{e.type === 'ROAD' ? 'Adjacent terminal' : 'Nearby access route & facilities'}</p>
      <div className="flex flex-wrap gap-1.5">
      {e.adjacentEntityIds.map(id => (
        <button key={id} type="button" onClick={() => { select(id); focus(id); }}
          className="rounded border border-line px-2 py-0.5 text-[11px] text-slate-300 hover:border-accent/60 hover:text-white">
          {ENTITY_NAMES[id]}
        </button>
      ))}
      </div>
    </div>
  );
}

function RoadView({ e, op, base }: { e: AirportEntity; op: OperationalState; base: OperationalState }) {
  const env = op.traffic[e.id];
  if (!env) return <p className="text-xs text-slate-400">No traffic data configured for this segment.</p>;
  const t = env.data; const b = base.traffic[e.id]?.data;
  const ratio = t.freeFlowSpeedKmh ? t.currentSpeedKmh / t.freeFlowSpeedKmh : null;
  const ttr = travelTimeRatio(t);
  const changed = b && b.currentSpeedKmh !== t.currentSpeedKmh;
  const blocked = t.status === 'BLOCKED' || t.status === 'SEVERE';
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Current speed" value={num(t.currentSpeedKmh)} unit="km/h" state={env.state} tone={blocked ? 'crit' : 'default'}
          definition={<>Provider-observed speed when LIVE; scenario fixture otherwise. Source: {env.sourceLabel}.</>}
          baseline={changed ? `${num(b!.currentSpeedKmh)} km/h` : undefined} />
        <KpiCard label="Free-flow speed" value={t.freeFlowSpeedKmh ?? '—'} unit="km/h" state={env.state}
          definition="Reference speed with no congestion, as supplied by the source." />
        <KpiCard label="Speed ratio" value={ratio == null ? '—' : num(ratio, 2)} unit="current ÷ free-flow" state={env.state}
          definition="Current speed ÷ free-flow speed (spec §6). 1.0 = free flow." />
        <KpiCard label="Travel-time ratio" value={ttr == null ? '—' : `×${num(ttr, 1)}`} state={env.state}
          definition={<>Segment travel time at current speed ÷ travel time at free-flow speed, over {num(t.lengthM)} m.</>} />
        <div className="col-span-2">
          <KpiCard label="Incident / blockage state" value={STATUS_LABEL[t.status]} state={env.state} tone={blocked ? 'crit' : 'default'}
            definition="Derived from the speed ratio thresholds in config, or set by a scenario. Scenario values are not an actual closure." />
        </div>
      </div>
      <Section title="Segment" id={`h-seg-${e.id}`}>
        <Row k="Segment ID" v={String(e.properties.segmentId ?? e.id)} />
        <Row k="Direction" v={String(e.properties.direction ?? '—')} />
        <Row k="Length" v={`${num(t.lengthM)} m`} />
        <Row k="Source timestamp" v={new Date(env.observedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) + ' IST'} />
        <Row k="Quality" v={<span className="text-[11px]">{env.quality}</span>} />
        {e.id === SCENARIO_MONSOON.roadEntityId && (
          <p className="mt-2 text-[11px] text-slate-400">Scenario impact: this is the configured segment for <strong className="text-slate-200">{SCENARIO_MONSOON.name}</strong>; it feeds the Terminal 2 road capacity factor.</p>
        )}
      </Section>
      <EntityAlertHistory e={e} />
      <AdjacentLinks e={e} />
      <Provenance e={e} />
    </>
  );
}

function RunwayView({ e }: { e: AirportEntity }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Runway" value={String(e.properties.designator)} state="SIMULATION" definition="Configured runway identifier from the demo geometry registry." />
        <KpiCard label="Scenario status" value={FEATURES.scenarioB ? 'Ready' : 'Not enabled'} state="SIMULATION"
          definition="Scenario B (simulated runway closure and synthetic arrival backlog) is optional and not enabled in this build." />
      </div>
      <Section title="Runway" id={`h-rwy-${e.id}`}>
        <Row k="Length (from geometry)" v={`${num(Number(e.properties.lengthM))} m`} />
        <Row k="Width (assumed)" v={`${e.properties.widthM} m`} />
        <p className="mt-2 rounded border border-line bg-ink-850/60 p-2 text-[11px] leading-snug text-slate-400">
          No actual runway operational status is shown: this PoC has no authorized runway data source.
        </p>
      </Section>
      <Provenance e={e} />
    </>
  );
}

function ParkingView({ e, op }: { e: AirportEntity; op: OperationalState }) {
  const p = op.parking[e.id];
  if (!p) return null;
  const pct = Math.round((p.occupied / p.capacityAssumed) * 100);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Occupancy proxy" value={pct} unit="%" state="SIMULATION" sub={`${num(p.occupied)} of ${num(p.capacityAssumed)} (assumed)`}
          definition="Configured occupancy ÷ assumed capacity. Simulated until integrated with verified parking data." />
        <KpiCard label="Available (assumed)" value={num(p.capacityAssumed - p.occupied)} unit="spaces" state="SIMULATION"
          definition="Assumed capacity minus configured occupancy. Not a live count." />
      </div>
      <Section title="Access" id={`h-park-${e.id}`}>
        <p className="text-xs text-slate-400">Connected access road and terminal:</p>
        <AdjacentLinks e={e} />
      </Section>
      <Provenance e={e} />
    </>
  );
}

function FacilityView({ e, op }: { e: AirportEntity; op: OperationalState }) {
  return (
    <>
      <Section title="Facility" id={`h-fac-${e.id}`}>
        <Row k="Type" v={String(e.properties.facilityType ?? 'Facility')} />
        <Row k="Configured status" v={op.facilities[e.id]?.status ?? '—'} />
        <p className="mt-2 text-[11px] text-slate-500">No operational KPIs are assigned to this facility in the PoC.</p>
      </Section>
      <Provenance e={e} />
    </>
  );
}

function OverviewView({ op }: { op: OperationalState }) {
  const windowMinutes = useApp(s => s.assumptions.windowMinutes);
  const select = useApp(s => s.select);
  const focus = useApp(s => s.focus);
  const t2 = op.terminals['terminal-t2']; const t1 = op.terminals['terminal-t1'];
  const totalPax = Object.values(op.terminals).reduce((s, t) => s + t.arrivingPassengers, 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label={`Arrival demand (${windowMinutes} min)`} value={num(totalPax)} unit="pax" state="SIMULATION" definition={`Estimated passengers across all terminals in the next ${windowMinutes} minutes (synthetic).`} />
        <KpiCard label="Rainfall" value={num(op.weather.data.precipitationMmPerHour, 1)} unit="mm/h" state={op.weather.state} definition="From the weather card source; scripted during a scenario." />
      </div>
      <Section title="Facilities" id="h-overview">
        <ul className="space-y-1">
          {[['terminal-t2', t2], ['terminal-t1', t1]].map(([id, k]) => (
            <li key={id as string}>
              <button type="button" data-tour={id as string} onClick={() => { select(id as string); focus(id as string); }} className="flex w-full items-center justify-between rounded-md border border-line bg-ink-850/60 px-2 py-1.5 text-xs hover:border-accent/50">
                <span className="text-slate-100">{ENTITY_NAMES[id as string]}</span>
                <span className="tabular text-slate-300">Index {(k as TerminalKpis).pressure.index} · {(k as TerminalKpis).pressure.band}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">Select a terminal, road, runway or car park on the map to inspect it.</p>
      </Section>
    </>
  );
}

export function EntityInspector() {
  const selectedId = useApp(s => s.selectedEntityId);
  const select = useApp(s => s.select);
  const focus = useApp(s => s.focus);
  const phase = useApp(s => s.machine.phase);
  const { current: op, baseline } = useOperational();
  const e = selectedId ? ENTITY_BY_ID[selectedId] : null;
  const typeLabel: Record<string, string> = { TERMINAL: 'Terminal', ROAD: 'Access road', RUNWAY: 'Runway', PARKING: 'Parking / MLCP', FACILITY: 'Facility' };

  return (
    <div>
      <header className="flex items-start justify-between gap-2 border-b border-line px-3.5 py-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.12em] text-accent uppercase">{e ? typeLabel[e.type] : 'Airport overview'}</p>
          <h2 className="text-base font-semibold text-white">{e ? e.name : 'BOM — all facilities'}</h2>
        </div>
        {e && (
          <div className="flex gap-1">
            <button type="button" onClick={() => focus(e.id)} className="rounded border border-line px-2 py-1 text-[11px] text-slate-300 hover:text-white">View on map</button>
            <button type="button" onClick={() => select(null)} aria-label="Clear selection" className="rounded border border-line px-2 py-1 text-[11px] text-slate-300 hover:text-white">✕</button>
          </div>
        )}
      </header>
      <div className="px-3.5 py-3">
        {!e && <OverviewView op={op} />}
        {e?.type === 'TERMINAL' && op.terminals[e.id] && (
          <TerminalView e={e} k={op.terminals[e.id]} kBase={baseline.terminals[e.id]} op={op} scenarioActive={phase !== 'IDLE'} />
        )}
        {e?.type === 'ROAD' && <RoadView e={e} op={op} base={baseline} />}
        {e?.type === 'RUNWAY' && <RunwayView e={e} />}
        {e?.type === 'PARKING' && <ParkingView e={e} op={op} />}
        {e?.type === 'FACILITY' && <FacilityView e={e} op={op} />}
      </div>
    </div>
  );
}
