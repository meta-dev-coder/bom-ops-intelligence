/**
 * Open-Meteo current conditions at BOM. NOTE (spec §7): the free API is non-commercial only; a
 * commercial demo needs OPEN_METEO_API_KEY (customer endpoint). "current" values are model
 * nowcasts on a ~1–11 km grid, not a station observation, and are labelled that way.
 */
import type { WeatherRecord } from '../../src/types/telemetry';

const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  80: 'Light showers', 81: 'Showers', 82: 'Violent showers', 95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, heavy hail',
};

export function openMeteoUrl(lat: number, lon: number, apiKey?: string) {
  const host = apiKey ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
  const q = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    current: 'temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
    wind_speed_unit: 'kmh', timezone: 'Asia/Kolkata',
  });
  if (apiKey) q.set('apikey', apiKey);
  return `${host}/v1/forecast?${q}`;
}

export function parseOpenMeteo(body: any): { data: WeatherRecord; observedAt: string; quality: string } {
  const c = body?.current;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const rec: WeatherRecord = {
    temperatureC: num(c?.temperature_2m),
    windSpeedKmh: num(c?.wind_speed_10m),
    windDirectionDeg: num(c?.wind_direction_10m),
    // Open-Meteo "current" precipitation is the sum over the preceding interval (15 min) in mm.
    precipitationMmPerHour: num(c?.precipitation) * (3600 / (num(c?.interval) || 900)),
    condition: WMO[c?.weather_code as number] ?? `WMO code ${c?.weather_code}`,
    kind: 'MODEL',
  };
  if (Object.values(rec).some(v => typeof v === 'number' && Number.isNaN(v))) throw new Error('OPEN_METEO_SCHEMA');
  if (typeof c?.time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(c.time)) throw new Error('OPEN_METEO_SCHEMA');
  const offset = typeof body.utc_offset_seconds === 'number' ? body.utc_offset_seconds : 19800;
  const sign = offset >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(offset) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((Math.abs(offset) % 3600) / 60)).padStart(2, '0');
  return {
    data: { ...rec, precipitationMmPerHour: Math.round(rec.precipitationMmPerHour * 10) / 10 },
    observedAt: `${c.time}:00${sign}${hh}:${mm}`,
    quality: `Model nowcast (grid ~1–11 km at ${body.latitude?.toFixed?.(3)}, ${body.longitude?.toFixed?.(3)}), not a station observation`,
  };
}

export function createOpenMeteoFetcher(opts: { lat: number; lon: number; apiKey?: string; fetchImpl?: typeof fetch }) {
  const f = opts.fetchImpl ?? fetch;
  return async (signal: AbortSignal) => {
    const res = await f(openMeteoUrl(opts.lat, opts.lon, opts.apiKey), { signal });
    if (!res.ok) throw new Error(`OPEN_METEO_HTTP_${res.status}`);
    return parseOpenMeteo(await res.json());
  };
}
