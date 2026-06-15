import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { faker } from '@faker-js/faker';
import { NeighborsStationDrawer } from './NeighborsStationDrawer';
import type { NeighborStationDto } from '../../types/neighbors';

// Faker-generated station data — randomised each test run, never hardcoded.
const sampleStation: NeighborStationDto = {
  provider: 'WeatherGov',
  sourceId: faker.string.alphanumeric(4).toUpperCase(),
  name: faker.location.city() + ' Station',
  discoveryKind: 'airport',
  lat: faker.location.latitude({ min: 25, max: 49 }),
  lon: faker.location.longitude({ min: -124, max: -66 }),
  distanceMiles: faker.number.float({ min: 0.5, max: 49, fractionDigits: 1 }),
  lastObservedAtUtc: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  freshnessMinutes: 10,
  tempF: faker.number.float({ min: 20, max: 110, fractionDigits: 1 }),
  humidity: faker.number.int({ min: 10, max: 100 }),
  dewPoint: faker.number.float({ min: 10, max: 80, fractionDigits: 1 }),
  feelsLike: faker.number.float({ min: 20, max: 110, fractionDigits: 1 }),
  baromRelIn: faker.number.float({ min: 28, max: 31, fractionDigits: 2 }),
  baromAbsIn: null,
  windSpeedMph: faker.number.float({ min: 0, max: 40, fractionDigits: 1 }),
  windGustMph: null,
  windDir: faker.number.int({ min: 0, max: 359 }),
  hourlyRainIn: null,
  dailyRainIn: 0.0,
  weeklyRainIn: null,
  monthlyRainIn: null,
  yearlyRainIn: null,
  solarRadiation: null,
  uv: null,
};
const sampleStationName = sampleStation.name ?? '';

describe('NeighborsStationDrawer', () => {
  it('is hidden when open=false', () => {
    render(<NeighborsStationDrawer open={false} onClose={vi.fn()} stations={[sampleStation]} />);
    expect(screen.queryByTestId('neighbors-station-drawer')).not.toBeInTheDocument();
  });

  it('renders station list when open', () => {
    render(<NeighborsStationDrawer open onClose={vi.fn()} stations={[sampleStation]} />);

    expect(screen.getByTestId('neighbors-station-drawer')).toBeInTheDocument();
    expect(screen.getAllByTestId('neighbors-station-row')).toHaveLength(1);
    expect(screen.getByText(sampleStationName)).toBeInTheDocument();
  });

  it('shows distance and provider badge', () => {
    render(<NeighborsStationDrawer open onClose={vi.fn()} stations={[sampleStation]} />);

    expect(screen.getByText(`${sampleStation.distanceMiles.toFixed(1)} mi`)).toBeInTheDocument();
    expect(screen.getByText('NWS')).toBeInTheDocument();
    expect(screen.getByTestId('neighbors-station-kind-badge')).toHaveTextContent('Airport');
  });

  it('shows a match note when search returns multiple result kinds', () => {
    const cityStation: NeighborStationDto = {
      ...sampleStation,
      sourceId: faker.string.alphanumeric(4).toUpperCase(),
      name: faker.location.city() + ' Station',
      discoveryKind: 'city',
    };

    render(<NeighborsStationDrawer open onClose={vi.fn()} stations={[sampleStation, cityStation]} />);

    expect(screen.getByTestId('neighbors-station-search-match-note')).toHaveTextContent('Multiple match types');
  });

  it('shows temperature and humidity', () => {
    render(<NeighborsStationDrawer open onClose={vi.fn()} stations={[sampleStation]} />);

    expect(screen.getByText(`${(sampleStation.tempF ?? 0).toFixed(1)}°F`)).toBeInTheDocument();
    expect(screen.getByText(`${String(sampleStation.humidity ?? 0)}% RH`)).toBeInTheDocument();
  });

  it('shows empty state when no stations', () => {
    render(<NeighborsStationDrawer open onClose={vi.fn()} stations={[]} />);

    expect(screen.getByTestId('neighbors-station-drawer-empty')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<NeighborsStationDrawer open onClose={onClose} stations={[]} />);

    fireEvent.click(screen.getByTestId('neighbors-station-drawer-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<NeighborsStationDrawer open onClose={onClose} stations={[]} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('moves initial focus to the close button', async () => {
    render(<NeighborsStationDrawer open onClose={vi.fn()} stations={[sampleStation]} />);

    await waitFor(() => {
      expect(screen.getByTestId('neighbors-station-drawer-close')).toHaveFocus();
    });
  });

  it('calls onPinToggle when pin button clicked', () => {
    const onPinToggle = vi.fn();
    render(
      <NeighborsStationDrawer
        open
        onClose={vi.fn()}
        stations={[sampleStation]}
        onPinToggle={onPinToggle}
      />,
    );

    fireEvent.click(screen.getByTestId('neighbors-station-pin-button'));

    expect(onPinToggle).toHaveBeenCalledWith(sampleStation);
  });

  it('keeps keyboard focus inside the drawer', () => {
    render(<NeighborsStationDrawer open onClose={vi.fn()} stations={[sampleStation]} onPinToggle={vi.fn()} />);

    const close = screen.getByTestId('neighbors-station-drawer-close');
    const pin = screen.getByTestId('neighbors-station-pin-button');

    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(pin).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
  });

  it('shows station count in heading', () => {
    render(<NeighborsStationDrawer open onClose={vi.fn()} stations={[sampleStation]} />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('(1)');
  });

  it('renders multiple stations', () => {
    const station2: NeighborStationDto = { ...sampleStation, sourceId: faker.string.alphanumeric(4).toUpperCase(), name: faker.location.city() + ' Station', distanceMiles: faker.number.float({ min: 10, max: 49, fractionDigits: 1 }) };
    render(<NeighborsStationDrawer open onClose={vi.fn()} stations={[sampleStation, station2]} />);

    expect(screen.getAllByTestId('neighbors-station-row')).toHaveLength(2);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <NeighborsStationDrawer open onClose={vi.fn()} stations={[sampleStation]} />,
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
