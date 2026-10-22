// @vitest-environment jsdom
/**
 * Component tests (spec §11.1, SC-02): the inspector shows the right content per entity type,
 * every KPI carries a state tag, and the alert card + role gating behave.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertCenter } from '../src/app/layout/AlertCenter';
import { EntityInspector } from '../src/components/EntityInspector';
import { ScenarioControls } from '../src/components/ScenarioControls';
import { DemoTour } from '../src/demo/DemoTour';
import { useApp } from '../src/state/store';

const initial = useApp.getState();
beforeEach(() => { useApp.setState(initial, true); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const select = (id: string | null) => act(() => useApp.getState().select(id));
const runToActive = () => {
  vi.useFakeTimers();
  act(() => { useApp.getState().runScenario(); });
  act(() => { vi.runAllTimers(); });
};

describe('EntityInspector per entity type (SC-02)', () => {
  it('shows the airport overview when nothing is selected', () => {
    render(<EntityInspector />);
    expect(screen.getByText('Airport overview')).toBeTruthy();
    expect(screen.getByText(/Index 42 · Moderate/)).toBeTruthy();
  });

  it('Terminal 2: demand index, arrivals, pressure, dispatch delay, staging, contributing flights, alert history', () => {
    select('terminal-t2');
    render(<EntityInspector />);
    expect(screen.getByRole('heading', { name: 'Terminal 2' })).toBeTruthy();
    expect(screen.getByText('Passenger Demand / Forecourt Pressure Index')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('1,200')).toBeTruthy();
    expect(screen.getByText('Est. dispatch delay (illustrative)')).toBeTruthy();
    expect(screen.getByText('Cab staging utilization')).toBeTruthy();
    expect(screen.getByText('Contributing arrivals')).toBeTruthy();
    expect(screen.getByText('Alert history')).toBeTruthy();
  });

  it('Terminal 1: synthetic demand index, apron stands, cab staging and its access route', () => {
    select('terminal-t1');
    render(<EntityInspector />);
    expect(screen.getByText('Synthetic Demand Index')).toBeTruthy();
    expect(screen.getByText('Apron stand occupancy')).toBeTruthy();
    expect(screen.getByText('Cab staging utilization')).toBeTruthy();
    expect(screen.getByText('Nearby access route & facilities')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nehru Road — T1 approach' })).toBeTruthy();
    expect(screen.queryByText('Est. dispatch delay (illustrative)')).toBeNull();
  });

  it('Access road: speeds, ratios, blockage state, segment details and adjacent terminal', () => {
    select('road-sahar-inbound');
    render(<EntityInspector />);
    for (const label of ['Current speed', 'Free-flow speed', 'Speed ratio', 'Travel-time ratio', 'Incident / blockage state', 'Segment ID', 'Direction', 'Source timestamp']) {
      expect(screen.getByText(label), label).toBeTruthy();
    }
    expect(screen.getByText('SAHAR-EL-IN-01')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Terminal 2' })).toBeTruthy();
  });

  it('Runway: identifier and scenario status, and no claim of actual operational status', () => {
    select('runway-09-27');
    render(<EntityInspector />);
    expect(screen.getByText('09/27')).toBeTruthy();
    expect(screen.getByText('Not enabled')).toBeTruthy();
    expect(screen.getByText(/No actual runway operational status is shown/)).toBeTruthy();
  });

  it('Parking: occupancy proxy and assumed availability, labelled simulated', () => {
    select('parking-t2-mlcp');
    render(<EntityInspector />);
    expect(screen.getByText('Occupancy proxy')).toBeTruthy();
    expect(screen.getByText('Available (assumed)')).toBeTruthy();
  });

  it('Generic facility: type and configured status only — no unrelated KPIs', () => {
    select('facility-ga-terminal');
    render(<EntityInspector />);
    expect(screen.getByText('Configured status')).toBeTruthy();
    expect(screen.queryByText(/Demand Index/)).toBeNull();
    expect(screen.queryByText('Current speed')).toBeNull();
  });

  it('every KPI card shows a data-state tag (FR-04)', () => {
    for (const id of ['terminal-t2', 'terminal-t1', 'road-sahar-inbound', 'parking-t2-mlcp']) {
      select(id);
      const { container, unmount } = render(<EntityInspector />);
      const cards = container.querySelectorAll('.rounded-lg.border');
      expect(cards.length, id).toBeGreaterThan(0);
      cards.forEach(card => expect(card.textContent, `${id}: ${card.textContent}`).toMatch(/LIVE|STALE|SIMULATION/));
      unmount();
    }
  });

  it('shows baseline next to scenario values once the scenario is active', () => {
    runToActive();
    select('terminal-t2');
    render(<EntityInspector />);
    expect(screen.getByText('86')).toBeTruthy();
    expect(screen.getByText('Baseline 42 (Moderate)')).toBeTruthy();
  });
});

describe('AlertCenter (SC-06, FR-11)', () => {
  it('renders nothing before a scenario', () => {
    const { container } = render(<AlertCenter />);
    expect(container.textContent).toBe('');
  });

  it('shows the structured card, acknowledges, and expands every section', () => {
    runToActive();
    render(<AlertCenter />);
    const region = screen.getByRole('region', { name: 'Active recommendation' });
    expect(within(region).getByText('Terminal 2 forecourt demand pressure elevated')).toBeTruthy();
    fireEvent.click(within(region).getByRole('button', { name: 'Acknowledge' }));
    expect(useApp.getState().alerts[0].status).toBe('ACKNOWLEDGED');
    fireEvent.click(within(region).getByRole('button', { name: 'View details' }));
    for (const t of ['Observation', 'Estimated impact', 'Contributing factors', 'Assumptions & limitations', 'Data provenance', 'Affected entities']) {
      expect(within(region).getByText(t), t).toBeTruthy();
    }
    expect(within(region).getByText(/SIMULATION — NOT AN OPERATIONAL INSTRUCTION/)).toBeTruthy();
  });

  it('hides act-on controls for a Viewer and shows assign/resolve for a Supervisor (FR-12)', () => {
    runToActive();
    act(() => useApp.getState().setRole('VIEWER'));
    act(() => useApp.getState().setUi({ alertExpanded: true }));
    const { unmount } = render(<AlertCenter />);
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
    expect(screen.getByText(/can view this alert but not act on it/)).toBeTruthy();
    unmount();
    act(() => useApp.getState().setRole('SUPERVISOR'));
    render(<AlertCenter />);
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeTruthy();
    expect(screen.getByLabelText('Assign owner')).toBeTruthy();
  });
});

describe('ScenarioControls role gating (FR-12)', () => {
  it('disables Run for a Viewer and explains why', () => {
    act(() => useApp.getState().setRole('VIEWER'));
    render(<ScenarioControls />);
    expect((screen.getByRole('button', { name: 'Run scenario' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/can view outcomes but not run scenarios/)).toBeTruthy();
  });
});

describe('Guided demo start tile', () => {
  it('appears on a first visit and can be skipped', () => {
    localStorage.clear();
    render(<DemoTour />);
    expect(screen.getByRole('dialog', { name: /Monsoon squall meets/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Skip — explore on my own/ }));
    expect(useApp.getState().demo.mode).toBe('off');
    expect(localStorage.getItem('bom_demo_seen_v1')).toBe('1');
  });
});
