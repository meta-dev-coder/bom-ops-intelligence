/**
 * Synthetic aircraft (spec §5.2): deterministic tracks played on a looping 15-minute clock.
 * Visual time only — no KPI reads it. Reset puts the clock back to the window start, so every
 * aircraft returns to the same initial position (SC-07).
 */
import {
  Cartesian2, Cartesian3, CallbackPositionProperty, CallbackProperty, ClockRange, Color, ConstantProperty, Credit, CustomDataSource, DistanceDisplayCondition,
  HeightReference, JulianDate, LabelStyle, Math as CMath, SampledPositionProperty, TimeInterval,
  TimeIntervalCollection, VerticalOrigin, type Viewer,
} from 'cesium';
import { BASELINE_FIXTURE } from '../data/MockDataService';
import { FEATURES } from '../config/featureFlags';
import { buildTrack, heightAt, type AircraftFixture, type RunwayAxis } from './aircraftPaths';
import { ENTITY_BY_ID } from './EntityRegistry';
import type { LiveAircraft } from '../types/telemetry';

const ADSB_CREDIT = new Credit('Aircraft positions: adsb.lol (ODbL)', true);
/** Extrapolate a live position along its track for at most this long (s), then hold it. */
const MAX_EXTRAPOLATION_S = 30;

const PLANE_SVG = (color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="${color}" stroke="#020617" stroke-width="0.8" d="M12 2c.8 0 1.3.9 1.3 2v5.2l7.7 4.6v2l-7.7-2.3v4.6l2.2 1.7V21L12 20.1 8.5 21v-1.2l2.2-1.7v-4.6L3 15.8v-2l7.7-4.6V4c0-1.1.5-2 1.3-2z"/></svg>`)}`;

/** Runway 27 axis from the curated runway polygon: land at the east end, roll west. */
function runway27Axis(): RunwayAxis {
  const ring = (ENTITY_BY_ID['runway-09-27'].geometry as { coordinates: number[][][] }).coordinates[0];
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number];
  const west = mid(ring[0], ring[3]); const east = mid(ring[1], ring[2]);
  return west[0] < east[0] ? { landingEnd: east, farEnd: west } : { landingEnd: west, farEnd: east };
}

export function installAircraftLayer(viewer: Viewer) {
  const ds = new CustomDataSource('aircraft');
  void viewer.dataSources.add(ds);
  const start = JulianDate.fromIso8601(BASELINE_FIXTURE.windowStart);
  const stop = JulianDate.addSeconds(start, BASELINE_FIXTURE.windowMinutes * 60, new JulianDate());
  const clock = viewer.clock;
  clock.startTime = start.clone();
  clock.stopTime = stop.clone();
  clock.currentTime = start.clone();
  clock.clockRange = ClockRange.LOOP_STOP;
  clock.multiplier = FEATURES.aircraftClockMultiplier;

  const axis = runway27Axis();
  for (const ac of BASELINE_FIXTURE.aircraft as AircraftFixture[]) {
    const track = buildTrack(ac, axis);
    const pos = new SampledPositionProperty();
    for (const s of track.samples) pos.addSample(JulianDate.addSeconds(start, s.t, new JulianDate()), Cartesian3.fromDegrees(s.lon, s.lat, s.h));
    const first = JulianDate.addSeconds(start, track.samples[0].t, new JulianDate());
    const last = JulianDate.addSeconds(start, track.samples[track.samples.length - 1].t, new JulianDate());
    const color = ac.kind === 'ARRIVAL' ? '#7dd3fc' : '#c4b5fd';
    ds.entities.add({
      id: `aircraft:${ac.id}`,
      availability: new TimeIntervalCollection([new TimeInterval({ start: first, stop: last })]),
      position: pos,
      billboard: {
        image: PLANE_SVG(color), width: 26, height: 26,
        rotation: CMath.toRadians(-track.headingDeg), alignedAxis: Cartesian3.UNIT_Z,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: new CallbackProperty(time => {
          const t = time ? JulianDate.secondsDifference(time, start) : 0;
          const h = heightAt(track, t);
          const alt = h == null ? '' : h < 10 ? 'GND' : `${Math.round((h * 3.281) / 100) * 100} ft`;
          return `${ac.callsign} · ${alt} · SIM`;
        }, false),
        font: '500 11px Inter, system-ui, sans-serif', fillColor: Color.fromCssColorString(color),
        outlineColor: Color.fromCssColorString('#020617'), outlineWidth: 3, style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.TOP, pixelOffset: new Cartesian2(0, 16),
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new DistanceDisplayCondition(0, 30_000),
      },
    });
  }

  // Real mode: live ADS-B positions in their own data source; the synthetic tracks are hidden.
  const liveDs = new CustomDataSource('aircraft-live');
  void viewer.dataSources.add(liveDs);
  liveDs.show = false;
  let wantVisible = true;
  let liveMode = false;
  const apply = () => {
    ds.show = wantVisible && !liveMode;
    liveDs.show = wantVisible && liveMode;
    viewer.scene.requestRender();
  };

  /** Real mode on/off; `list` is the latest live positions (empty until the first fetch). */
  function setLive(enabled: boolean, list: LiveAircraft[]) {
    liveMode = enabled;
    if (enabled) viewer.creditDisplay.addStaticCredit(ADSB_CREDIT);
    else viewer.creditDisplay.removeStaticCredit(ADSB_CREDIT);
    const receivedAt = Date.now();
    const seen = new Set<string>();
    for (const a of list) {
      const id = `live:${a.hex}`;
      seen.add(id);
      const color = a.onGround ? '#fbbf24' : '#7dd3fc';
      const position = new CallbackPositionProperty((_t, result) => {
        const moving = !a.onGround && a.groundSpeedKt != null && a.trackDeg != null;
        const dt = moving ? Math.min(MAX_EXTRAPOLATION_S, a.positionAgeS + (Date.now() - receivedAt) / 1000) : 0;
        const d = moving ? a.groundSpeedKt! * 0.5144 * dt : 0;
        const b = ((a.trackDeg ?? 0) * Math.PI) / 180;
        const lat = a.lat + (Math.cos(b) * d) / 110_540;
        const lon = a.lon + (Math.sin(b) * d) / (111_320 * Math.cos((a.lat * Math.PI) / 180));
        return Cartesian3.fromDegrees(lon, lat, a.onGround ? 2 : a.altitudeFt * 0.3048, undefined, result);
      }, false);
      const alt = a.onGround ? 'GND' : `${Math.round(a.altitudeFt / 100) * 100} ft`;
      const text = `${a.callsign ?? a.registration ?? a.hex}${a.typeCode ? ` · ${a.typeCode}` : ''} · ${alt} · LIVE`;
      const existing = liveDs.entities.getById(id);
      if (existing) {
        existing.position = position;
        existing.billboard!.image = new ConstantProperty(PLANE_SVG(color));
        existing.billboard!.rotation = new ConstantProperty(CMath.toRadians(-(a.trackDeg ?? 0)));
        existing.label!.text = new ConstantProperty(text);
      } else {
        liveDs.entities.add({
          id,
          position,
          billboard: {
            image: PLANE_SVG(color), width: 26, height: 26,
            rotation: CMath.toRadians(-(a.trackDeg ?? 0)), alignedAxis: Cartesian3.UNIT_Z,
            heightReference: HeightReference.RELATIVE_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text, font: '500 11px Inter, system-ui, sans-serif', fillColor: Color.fromCssColorString(color),
            outlineColor: Color.fromCssColorString('#020617'), outlineWidth: 3, style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.TOP, pixelOffset: new Cartesian2(0, 16),
            heightReference: HeightReference.RELATIVE_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            // Parked/taxiing aircraft cluster at the gates: label them only when zoomed in.
            distanceDisplayCondition: new DistanceDisplayCondition(0, a.onGround ? 3_500 : 60_000),
          },
        });
      }
    }
    for (const e of [...liveDs.entities.values]) if (!seen.has(e.id)) liveDs.entities.remove(e);
    apply();
  }

  return {
    setLive,
    setVisible(v: boolean) { wantVisible = v; apply(); },
    setAnimating(v: boolean) { clock.shouldAnimate = v; viewer.scene.requestRender(); },
    reset() { clock.currentTime = start.clone(); viewer.scene.requestRender(); },
    destroy() { if (!viewer.isDestroyed()) { viewer.dataSources.remove(ds, true); viewer.dataSources.remove(liveDs, true); } },
  };
}
