import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricHistoryTable } from './MetricHistoryTable';
import type { MetricHistoryPoint } from '../../types/metrics';

const POINTS: readonly MetricHistoryPoint[] = [
  { timestampUtc: '2026-06-01T12:00:00Z', value: 72.4 },
  { timestampUtc: '2026-06-01T13:00:00Z', value: null },
  { timestampUtc: '2026-06-01T14:00:00Z', value: 68.0 },
];

describe('MetricHistoryTable', () => {
  it('renders the toggle button and hides content by default', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={POINTS} />);

    const toggle = screen.getByTestId('metric-detail-history-table-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('3 rows');
    expect(screen.queryByTestId('metric-detail-history-table-content')).not.toBeInTheDocument();
  });

  it('shows singular "row" label for a single point', () => {
    render(
      <MetricHistoryTable
        metricLabel="Temperature"
        unit="°F"
        points={[POINTS[0]]}
      />,
    );
    expect(screen.getByTestId('metric-detail-history-table-toggle')).toHaveTextContent('1 row)');
  });

  it('expands to show all rows when toggle is clicked', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={POINTS} />);

    fireEvent.click(screen.getByTestId('metric-detail-history-table-toggle'));

    expect(screen.getByTestId('metric-detail-history-table-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('metric-detail-history-table-content')).toBeInTheDocument();
    const values = screen.getAllByTestId('metric-detail-history-value').map((cell) => cell.textContent);
    expect(values).toContain('72.4 °F');
    expect(values).toContain('—');
    expect(values).toContain('68 °F');
    expect(values).toHaveLength(3);
  });

  it('collapses again when toggle is clicked a second time', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={POINTS} />);

    fireEvent.click(screen.getByTestId('metric-detail-history-table-toggle'));
    expect(screen.getByTestId('metric-detail-history-table-content')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('metric-detail-history-table-toggle'));
    expect(screen.queryByTestId('metric-detail-history-table-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-detail-history-table-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  it('starts expanded when defaultExpanded is true', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={POINTS} defaultExpanded />);

    expect(screen.getByTestId('metric-detail-history-table-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('metric-detail-history-table-content')).toBeInTheDocument();
  });

  it('shows null values as em-dash', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={POINTS} defaultExpanded />);

    const values = screen.getAllByTestId('metric-detail-history-value').map((c) => c.textContent);
    expect(values).toContain('—');
  });

  it('includes accessible caption with metric label and unit', () => {
    render(<MetricHistoryTable metricLabel="Wind Speed" unit="mph" points={POINTS} defaultExpanded />);

    // The <caption> element provides the table's accessible name.
    expect(screen.getByRole('table', { name: /Wind Speed/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /mph/ })).toBeInTheDocument();
  });

  it('renders column header with metric label and unit when expanded', () => {
    render(<MetricHistoryTable metricLabel="Wind Speed" unit="mph" points={POINTS} defaultExpanded />);

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toContain('Wind Speed (mph)');
  });

  it('labels timestamp column as Local by default', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={POINTS} defaultExpanded />);

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toContain('Timestamp (Local)');
  });

  it('labels timestamp column as Local when timezone is local', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={POINTS} defaultExpanded timezone="local" />);

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toContain('Timestamp (Local)');
  });

  it('formats timestamps in UTC when timezone is utc', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={[{ timestampUtc: '2026-06-01T12:00:00Z', value: 70 }]} defaultExpanded timezone="utc" />);

    const cells = screen.getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toContain('2026-06-01 12:00 UTC');
  });

  it('formats timestamps in local time when timezone is local', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={[{ timestampUtc: '2026-06-01T12:00:00Z', value: 70 }]} defaultExpanded timezone="local" />);

    const cells = screen.getAllByRole('cell').map((c) => c.textContent);
    // Local format omits the UTC suffix and uses local date getters
    const localDate = new Date('2026-06-01T12:00:00Z');
    const yyyy = localDate.getFullYear().toString();
    const mm = (localDate.getMonth() + 1).toString().padStart(2, '0');
    const dd = localDate.getDate().toString().padStart(2, '0');
    const hh = localDate.getHours().toString().padStart(2, '0');
    const min = localDate.getMinutes().toString().padStart(2, '0');
    expect(cells).toContain(`${yyyy}-${mm}-${dd} ${hh}:${min}`);
  });

  it('omits unit from header and caption when unit is empty', () => {
    render(<MetricHistoryTable metricLabel="Condition" unit="" points={POINTS} defaultExpanded />);

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).not.toContain('Condition ()');
    expect(headers).toContain('Condition');

    // Caption should not include "()" — check via table's accessible name.
    expect(screen.queryByRole('table', { name: /Condition \(\)/ })).not.toBeInTheDocument();
  });

  it('toggle button is keyboard reachable (focusable)', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={POINTS} />);
    const toggle = screen.getByTestId('metric-detail-history-table-toggle');
    expect(toggle.tagName).toBe('BUTTON');
  });

  it('toggle has aria-controls pointing to table content id', () => {
    render(<MetricHistoryTable metricLabel="Temperature" unit="°F" points={POINTS} defaultExpanded />);
    const toggle = screen.getByTestId('metric-detail-history-table-toggle');
    const content = screen.getByTestId('metric-detail-history-table-content');
    const contentId = toggle.getAttribute('aria-controls');
    expect(contentId).toBeTruthy();
    expect(content).toHaveAttribute('id', contentId ?? '');
  });
});
