/**
 * Station weather for VABB from NOAA's Aviation Weather Center (aviationweather.gov) — free, no key,
 * US-government data. A METAR reports present weather as codes, not a rainfall rate, so the rate
 * is ESTIMATED from the intensity/phenomenon and flagged `precipitationEstimated`.
 */
import type { WeatherRecord } from '../../src/types/telemetry';

export const METAR_URL = 'https://aviationweather.gov/api/data/metar?ids=VABB&format=json&hours=3';

const PHENOMENA: Record<string, string> = {
  RA: 'rain', DZ: 'drizzle', SN: 'snow', GR: 'hail', GS: 'small hail', TS: 'thunderstorm', SH: 'showers',
  FG: 'fog', BR: 'mist', HZ: 'haze', FU: 'smoke', DU: 'dust', SA: 'sand', SQ: 'squall', VC: 'in vicinity',
};

/** Rain-rate estimates (mm/h) by phenomenon and intensity: light / moderate / heavy (WMO intensity classes). */
const RATE: Record<string, [number, number, number]> = {
  DZ: [0.1, 0.5, 1.5], RA: [1.5, 5, 15], SHRA: [2, 8, 25], TSRA: [5, 15, 40], TS: [0, 0, 0],
};

export function decodeWeather(wx?: string | null): { condition: string; rainMmPerHour: number } {
  if (!wx || !wx.trim()) return { condition: '', rainMmPerHour: 0 };
  let rain = 0;
  const words: string[] = [];
  for (const token of wx.trim().split(/\s+/)) {
    const intensity = token.startsWith('+') ? 2 : token.startsWith('-') ? 0 : 1;
    const body = token.replace(/^[+-]/, '');
    const key = /TSRA/.test(body) ? 'TSRA' : /SHRA/.test(body) ? 'SHRA' : /RA/.test(body) ? 'RA' : /DZ/.test(body) ? 'DZ' : '';
    if (key && !body.startsWith('VC')) rain = Math.max(rain, RATE[key][intensity]);
    const parts = body.match(/.{2}/g) ?? [];
    const text = parts.map(p => PHENOMENA[p] ?? p).join(' ');
    words.push(`${intensity === 2 ? 'heavy ' : intensity === 0 ? 'light ' : ''}${text}`.trim());
  }
  const condition = words.join(', ');
  return { condition: condition.charAt(0).toUpperCase() + condition.slice(1), rainMmPerHour: rain };
}

const COVER: Record<string, string> = { CLR: 'Clear', SKC: 'Clear', CAVOK: 'Clear', FEW: 'Few clouds', SCT: 'Scattered clouds', BKN: 'Broken clouds', OVC: 'Overcast' };

export function parseMetar(body: unknown): { data: WeatherRecord; observedAt: string; quality: string } {
  if (!Array.isArray(body) || body.length === 0) throw new Error('METAR_EMPTY');
  const latest = [...body].sort((a: any, b: any) => (b.obsTime ?? 0) - (a.obsTime ?? 0))[0] as any;
  if (typeof latest.obsTime !== 'number' || typeof latest.temp !== 'number') throw new Error('METAR_SCHEMA');
  const wx = decodeWeather(latest.wxString);
  const windKt = typeof latest.wspd === 'number' ? latest.wspd : 0;
  const windDir = typeof latest.wdir === 'number' ? latest.wdir : NaN; // "VRB" = variable
  const visibilityKm = typeof latest.visib === 'number' ? Math.round(latest.visib * 1.609 * 10) / 10 : undefined;
  const sky = COVER[latest.cover] ?? '';
  return {
    data: {
      temperatureC: latest.temp,
      windSpeedKmh: Math.round(windKt * 1.852),
      windDirectionDeg: windDir,
      precipitationMmPerHour: wx.rainMmPerHour,
      precipitationEstimated: true,
      condition: [wx.condition, !wx.condition ? sky : ''].filter(Boolean).join('') || 'No significant weather',
      kind: 'OBSERVATION',
      visibilityKm,
      raw: typeof latest.rawOb === 'string' ? latest.rawOb : undefined,
    },
    observedAt: new Date(latest.obsTime * 1000).toISOString(),
    quality: 'METAR VABB (NOAA aviationweather.gov) — station observation; rainfall rate estimated from the present-weather code',
  };
}

export function createMetarFetcher(opts: { fetchImpl?: typeof fetch } = {}) {
  const f = opts.fetchImpl ?? fetch;
  return async (signal: AbortSignal) => {
    const res = await f(METAR_URL, { signal, headers: { 'User-Agent': 'bom-ops-intelligence-poc (github.com/meta-dev-coder/bom-ops-intelligence)' } });
    if (!res.ok) throw new Error(`METAR_HTTP_${res.status}`);
    return parseMetar(await res.json());
  };
}
