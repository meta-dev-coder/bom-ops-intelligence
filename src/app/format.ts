import { AIRPORT } from '../config/airport';

const timeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: AIRPORT.timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: AIRPORT.timeZone, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

/** All times in IST (spec §4.2). */
export const istTime = (iso?: string | number | Date) => (iso == null ? '—' : `${timeFmt.format(new Date(iso))} IST`);
export const istDateTime = (iso?: string) => (iso ? `${dateTimeFmt.format(new Date(iso))} IST` : '—');
export const etaFrom = (windowStart: string, offsetMin: number) => istTime(Date.parse(windowStart) + offsetMin * 60_000);
export const num = (n: number, digits = 0) => (Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—');
export const compass = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
