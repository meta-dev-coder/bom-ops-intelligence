/**
 * Deterministic synthetic aircraft tracks (spec §5.2). Pure: fixture + runway geometry in,
 * timestamped [lon, lat, heightAGL] samples out. Paths are straight approach/climb-out lines on
 * the runway's extended centreline — illustrative movement, not flight plans or ATC procedures.
 */
export interface AircraftFixture { id: string; callsign: string; category: string; kind: 'ARRIVAL' | 'DEPARTURE'; runway: string; startOffsetS: number }
export interface TrackSample { t: number; lon: number; lat: number; h: number }
export interface Track { id: string; callsign: string; category: string; kind: AircraftFixture['kind']; headingDeg: number; samples: TrackSample[] }

const M_LAT = 110_540;
const mLon = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Runway ends as [lon, lat]; `landingEnd` is the threshold aircraft touch down past. */
export interface RunwayAxis { landingEnd: [number, number]; farEnd: [number, number] }

function offset([lon, lat]: [number, number], bearingDeg: number, distM: number): [number, number] {
  const b = (bearingDeg * Math.PI) / 180;
  return [lon + (Math.sin(b) * distM) / mLon(lat), lat + (Math.cos(b) * distM) / M_LAT];
}
export function bearing(a: [number, number], b: [number, number]): number {
  const dx = (b[0] - a[0]) * mLon(a[1]); const dy = (b[1] - a[1]) * M_LAT;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

export function buildTrack(ac: AircraftFixture, rwy: RunwayAxis): Track {
  const hdg = bearing(rwy.landingEnd, rwy.farEnd); // direction of travel on the runway
  const back = (hdg + 180) % 360;
  const s: TrackSample[] = [];
  const t0 = ac.startOffsetS;
  if (ac.kind === 'ARRIVAL') {
    const finalM = 18_000, approachMs = 75; const glide = Math.tan((3 * Math.PI) / 180);
    const touchdown = offset(rwy.landingEnd, hdg, 300);
    const approachS = finalM / approachMs;
    for (let i = 0; i <= 12; i++) {
      const d = finalM * (1 - i / 12);
      const [lon, lat] = offset(touchdown, back, d);
      s.push({ t: t0 + approachS * (i / 12), lon, lat, h: Math.max(0, d * glide) + 2 });
    }
    // Roll-out: decelerate over ~1.8 km in 45 s, then hold off the runway.
    for (let i = 1; i <= 5; i++) {
      const f = 1 - (1 - i / 5) ** 2;
      const [lon, lat] = offset(touchdown, hdg, 1800 * f);
      s.push({ t: t0 + approachS + 45 * (i / 5), lon, lat, h: 2 });
    }
  } else {
    const start = offset(rwy.landingEnd, hdg, 100);
    for (let i = 0; i <= 5; i++) {
      const f = (i / 5) ** 2;
      const [lon, lat] = offset(start, hdg, 2000 * f);
      s.push({ t: t0 + 40 * (i / 5), lon, lat, h: 2 });
    }
    const lift = offset(start, hdg, 2000);
    for (let i = 1; i <= 10; i++) {
      const d = 16_000 * (i / 10);
      const [lon, lat] = offset(lift, hdg, d);
      s.push({ t: t0 + 40 + d / 85, lon, lat, h: 2 + d * 0.09 });
    }
  }
  return { id: ac.id, callsign: ac.callsign, category: ac.category, kind: ac.kind, headingDeg: hdg, samples: s };
}

/** Height (m AGL) at time t, linear between samples; null outside the track's interval. */
export function heightAt(track: Track, t: number): number | null {
  const s = track.samples;
  if (t < s[0].t || t > s[s.length - 1].t) return null;
  for (let i = 1; i < s.length; i++) {
    if (t <= s[i].t) {
      const f = (t - s[i - 1].t) / (s[i].t - s[i - 1].t || 1);
      return s[i - 1].h + f * (s[i].h - s[i - 1].h);
    }
  }
  return s[s.length - 1].h;
}
