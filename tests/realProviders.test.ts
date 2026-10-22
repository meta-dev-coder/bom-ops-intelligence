import { describe, expect, it } from 'vitest';
import adsb from './fixtures/adsblol-bom.json';
import metar from './fixtures/metar-vabb.json';
import { parseAdsbLol } from '../server/providers/adsbLol';
import { categoryFor, parseAeroDataBox, terminalFor } from '../server/providers/aerodatabox';
import { decodeWeather, parseMetar } from '../server/providers/metar';

describe('METAR VABB (aviationweather.gov)', () => {
  it('parses the latest real report: °C, kt → km/h, observation time, raw text', () => {
    const r = parseMetar(metar);
    expect(r.data.kind).toBe('OBSERVATION');
    expect(r.data.temperatureC).toBe(32);
    expect(r.data.windSpeedKmh).toBe(Math.round(6 * 1.852));
    expect(r.data.windDirectionDeg).toBe(360);
    expect(r.data.raw).toMatch(/^METAR VABB/);
    expect(r.observedAt).toBe('2026-10-22T15:00:00.000Z');
    expect(r.data.condition).toBe('Smoke');
    expect(r.data.precipitationEstimated).toBe(true);
    expect(r.data.precipitationMmPerHour).toBe(0);
  });
  it('estimates rain rate from intensity codes', () => {
    expect(decodeWeather('-RA').rainMmPerHour).toBe(1.5);
    expect(decodeWeather('RA').rainMmPerHour).toBe(5);
    expect(decodeWeather('+TSRA').rainMmPerHour).toBe(40);
    expect(decodeWeather('+TSRA').condition).toBe('Heavy thunderstorm rain');
    expect(decodeWeather('VCSH').rainMmPerHour).toBe(0);
    expect(decodeWeather('HZ').condition).toBe('Haze');
  });
  it('handles variable wind and rejects empty or malformed responses', () => {
    const v = parseMetar([{ ...metar[0], wdir: 'VRB' }]);
    expect(Number.isNaN(v.data.windDirectionDeg)).toBe(true);
    expect(() => parseMetar([])).toThrow('METAR_EMPTY');
    expect(() => parseMetar([{ obsTime: 1 }])).toThrow('METAR_SCHEMA');
  });
});

describe('adsb.lol aircraft', () => {
  it('maps real positions, ground state and callsigns; drops stale positions', () => {
    const r = parseAdsbLol(adsb, { maxPositionAgeS: 60, nowIso: '2026-10-22T15:20:00Z' });
    expect(r.data.length).toBeGreaterThan(0);
    const ground = r.data.find(a => a.hex === '801778')!;
    expect(ground).toMatchObject({ callsign: 'IGO901M', onGround: true, altitudeFt: 0, typeCode: 'A21N', registration: 'VT-NCE' });
    const air = r.data.find(a => a.hex === '801694')!;
    expect(air).toMatchObject({ onGround: false, altitudeFt: 17275 });
    expect(r.data.every(a => a.positionAgeS <= 60)).toBe(true);
    expect(parseAdsbLol(adsb, { maxPositionAgeS: 5, nowIso: '' }).data.length).toBeLessThan(r.data.length);
  });
  it('rejects a malformed body', () => {
    expect(() => parseAdsbLol({}, { maxPositionAgeS: 60, nowIso: '' })).toThrow('ADSB_SCHEMA');
  });
});

describe('AeroDataBox arrivals', () => {
  const now = Date.parse('2026-10-22T14:00:00Z');
  const assumptions = { seatsByCategory: { WIDEBODY: 300, NARROWBODY: 180, REGIONAL: 72 }, loadFactor: 0.85 };
  const body = { arrivals: [
    { number: 'EK 500', status: 'Expected', movement: { airport: { iata: 'DXB' }, scheduledTime: { utc: '2026-10-22 14:20Z' }, revisedTime: { utc: '2026-10-22 14:25Z' }, terminal: '2' }, aircraft: { model: 'Boeing 777-300ER' } },
    { number: '6E 5101', status: 'Expected', movement: { airport: { iata: 'DEL' }, scheduledTime: { utc: '2026-10-22 14:10Z' }, terminal: '1' }, aircraft: { model: 'Airbus A321 NEO' } },
    { number: 'AI 999', status: 'Canceled', movement: { airport: { iata: 'BLR' }, scheduledTime: { utc: '2026-10-22 14:15Z' }, terminal: '2' }, aircraft: { model: 'A320' } },
    { number: '9I 600', status: 'Expected', movement: { airport: { iata: 'GOI' }, scheduledTime: { utc: '2026-10-22 18:15Z' }, terminal: '1' }, aircraft: { model: 'ATR 72' } },
  ] };
  it('maps terminal, category, ETA offset (revised time wins) and drops cancelled / out-of-window flights', () => {
    const r = parseAeroDataBox(body, { now, assumptions, horizonMinutes: 120 });
    expect(r.data.map(f => f.flightNumber)).toEqual(['6E 5101', 'EK 500']);
    expect(r.data[1]).toMatchObject({ terminalId: 'terminal-t2', aircraftCategory: 'WIDEBODY', etaOffsetMinutes: 25, seatsAssumed: 300, origin: 'DXB' });
    expect(r.data[0]).toMatchObject({ terminalId: 'terminal-t1', aircraftCategory: 'NARROWBODY', etaOffsetMinutes: 10 });
  });
  it('classifies aircraft and terminals', () => {
    expect(categoryFor('Airbus A350-900')).toBe('WIDEBODY');
    expect(categoryFor('ATR 72-600')).toBe('REGIONAL');
    expect(categoryFor('Boeing 737-800')).toBe('NARROWBODY');
    expect(terminalFor('1C')).toBe('terminal-t1');
    expect(terminalFor(undefined)).toBe('terminal-unassigned');
  });
});
