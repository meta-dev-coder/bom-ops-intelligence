/**
 * Optional alert chime (spec §9.2: sound only as a setting, disabled by default). Plays once per
 * new alert; never loops. Uses WebAudio so there is no audio asset to ship.
 */
import { useEffect, useRef } from 'react';
import { useApp } from '../state/store';

export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.17);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* audio unavailable: silent by design */
  }
}

export function useAlertSound() {
  const latest = useApp(s => s.alerts.find(a => !a.archived)?.alertId ?? null);
  const enabled = useApp(s => s.settings.soundEnabled);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (latest && latest !== seen.current && enabled) playChime();
    seen.current = latest;
  }, [latest, enabled]);
}
