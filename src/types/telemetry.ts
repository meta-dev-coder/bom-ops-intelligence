/** Spec §7.1 — every value shown in the UI carries one of these states. */
export type DataState = 'LIVE' | 'STALE' | 'SIMULATION';

/** Spec §11.3 DataEnvelope<T>. */
export interface DataEnvelope<T> {
  data: T;
  sourceId: string;
  /** Human-readable provider/fixture name shown next to the state tag. */
  sourceLabel: string;
  state: DataState;
  /** When the provider says the value was true (ISO 8601). */
  observedAt: string;
  /** When we received it (ISO 8601). */
  fetchedAt: string;
  staleAfterSeconds: number;
  /** Free-text quality note, e.g. "model nowcast, ~11 km grid" or "segment match 18 m". */
  quality: string;
  errorCode?: string;
}

export interface WeatherRecord {
  temperatureC: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  precipitationMmPerHour: number;
  condition: string;
  /** OBSERVATION from a station, MODEL for a nowcast/forecast, SCRIPTED for a scenario value. */
  kind: 'OBSERVATION' | 'MODEL' | 'FIXTURE' | 'SCRIPTED';
}

export type RoadStatus = 'FREE_FLOW' | 'MODERATE' | 'HEAVY' | 'SEVERE' | 'BLOCKED';

export interface TrafficSegment {
  id: string;
  name: string;
  currentSpeedKmh: number;
  freeFlowSpeedKmh?: number;
  status: RoadStatus;
  lengthM: number;
}

export type AircraftCategory = 'WIDEBODY' | 'NARROWBODY' | 'REGIONAL';

export interface FlightRecord {
  id: string;
  flightNumber: string;
  origin?: string;
  destination?: string;
  terminalId: string;
  aircraftCategory: AircraftCategory;
  /** Minutes after the data-window start. */
  etaOffsetMinutes: number;
  seatsAssumed: number;
  loadFactorAssumed: number;
}

export interface ProviderHealth {
  providerId: string;
  label: string;
  state: DataState | 'UNAVAILABLE' | 'DISABLED';
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  error?: string;
  note?: string;
}
