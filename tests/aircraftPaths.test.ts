import { describe, expect, it } from 'vitest';
import { bearing, buildTrack, heightAt } from '../src/map/aircraftPaths';
import { BASELINE_FIXTURE } from '../src/data/MockDataService';

// Runway 27: land at the east end heading west.
const rwy27 = { landingEnd: [72.88067, 19.0888772] as [number, number], farEnd: [72.8476987, 19.0884168] as [number, number] };

describe('synthetic aircraft tracks (FR-06)', () => {
  it('are identical across builds (deterministic, no randomness)', () => {
    for (const ac of BASELINE_FIXTURE.aircraft as any[]) {
      expect(buildTrack(ac, rwy27)).toEqual(buildTrack({ ...ac }, rwy27));
    }
  });
  it('arrivals fly runway heading ~273° and descend to the runway', () => {
    const t = buildTrack({ id: 'a', callsign: 'X', category: 'WIDEBODY', kind: 'ARRIVAL', runway: '27', startOffsetS: 0 }, rwy27);
    expect(t.headingDeg).toBeGreaterThan(265);
    expect(t.headingDeg).toBeLessThan(275);
    expect(t.samples[0].h).toBeGreaterThan(900);
    expect(t.samples.at(-1)!.h).toBeLessThan(5);
    expect(t.samples.every((s, i, a) => i === 0 || s.t > a[i - 1].t)).toBe(true);
  });
  it('departures climb', () => {
    const t = buildTrack({ id: 'd', callsign: 'Y', category: 'NARROWBODY', kind: 'DEPARTURE', runway: '27', startOffsetS: 10 }, rwy27);
    expect(heightAt(t, 9)).toBeNull();
    expect(heightAt(t, t.samples.at(-1)!.t)!).toBeGreaterThan(1000);
  });
  it('bearing is clockwise from north', () => {
    expect(Math.round(bearing([72.86, 19.08], [72.86, 19.09]))).toBe(0);
    expect(Math.round(bearing([72.86, 19.08], [72.87, 19.08]))).toBe(90);
  });
});
