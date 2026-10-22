import { useEffect } from 'react';
import { FEATURES } from '../config/featureFlags';
import { MapControls } from '../components/MapControls';
import { useLiveData } from '../data/useLiveData';
import { DemoTour } from '../demo/DemoTour';
import { CesiumViewer } from '../map/CesiumViewer';
import { heavyRainThreshold } from '../simulation/demandPressure';
import { useApp, useOperational } from '../state/store';
import { AlertCenter } from './layout/AlertCenter';
import { EventHistory } from './layout/EventHistory';
import { LeftTelemetryPanel } from './layout/LeftTelemetryPanel';
import { RightIntelligencePanel } from './layout/RightIntelligencePanel';
import { SettingsPanel } from './layout/SettingsPanel';
import { TopBar } from './layout/TopBar';

function RainOverlay() {
  const { current } = useOperational();
  const threshold = useApp(s => heavyRainThreshold(s.assumptions));
  if (!FEATURES.rainOverlay || current.weather.data.precipitationMmPerHour < threshold) return null;
  return <div aria-hidden="true" className="rain pointer-events-none absolute inset-0 z-10 opacity-60" />;
}

export function App() {
  useLiveData();
  const reducedMotion = useApp(s => s.reducedMotion);
  const setUi = useApp(s => s.setUi);

  // Panels start closed on small screens (drawers), open on desktop.
  useEffect(() => {
    if (window.innerWidth < 1024) setUi({ left: false, right: window.innerWidth >= 768 });
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = (e: MediaQueryListEvent) => useApp.getState().setReducedMotion(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [setUi]);

  // Esc closes the topmost overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const { ui } = useApp.getState();
      if (ui.settings || ui.history) setUi({ settings: false, history: false });
      else if (ui.alertExpanded) setUi({ alertExpanded: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setUi]);

  return (
    <div data-reduced-motion={reducedMotion} className="relative h-full w-full overflow-hidden">
      <CesiumViewer />
      <RainOverlay />
      <div className="pointer-events-none absolute inset-0">
        <TopBar />
        <LeftTelemetryPanel />
        <RightIntelligencePanel />
        <MapControls />
        <AlertCenter />
        <SettingsPanel />
        <EventHistory />
        <DemoTour />
      </div>
    </div>
  );
}
