import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { CustomLayoutBuilder } from './CustomLayoutBuilder';
import {
  testDeviceIdColon,
  testDeviceName,
  testOtherDeviceIdColon,
} from '../../test/weatherTestData';
import { CUSTOM_LAYOUT_MAX_ITEMS, type CustomLayoutItem } from '../../types/customLayout';
import type { SettingsDeviceDto } from '../../types/settings';

const NO_DEVICES: readonly SettingsDeviceDto[] = [];

const STATION_A: SettingsDeviceDto = {
  macAddress: testDeviceIdColon,
  name: testDeviceName,
  nickname: null,
  isPrimary: true,
  displayOnDashboard: true,
  selectedMetricKeys: null,
  latitude: null,
  longitude: null,
  elevationMeters: null,
  address: null,
  location: null,
  lastSyncAtUtc: null,
};

const STATION_B: SettingsDeviceDto = {
  macAddress: testOtherDeviceIdColon,
  name: null,
  nickname: 'Garage',
  isPrimary: false,
  displayOnDashboard: true,
  selectedMetricKeys: null,
  latitude: null,
  longitude: null,
  elevationMeters: null,
  address: null,
  location: null,
  lastSyncAtUtc: null,
};

const TWO_STATIONS = [STATION_A, STATION_B] as const;

const PUBLIC_PICKER_SOURCE: SettingsDeviceDto = {
  macAddress: 'public:WeatherGov:KABC',
  name: 'Weather.gov - KABC',
  nickname: null,
  isPrimary: false,
  displayOnDashboard: true,
  selectedMetricKeys: null,
  latitude: null,
  longitude: null,
  elevationMeters: null,
  address: null,
  location: null,
  lastSyncAtUtc: null,
  sourceKind: 'public',
  provider: 'WeatherGov',
  sourceId: 'KABC',
};

function itemTitles(): readonly string[] {
  return screen.getAllByTestId('settings-custom-layout-item').map((item) => (
    within(item).getByTestId('settings-custom-layout-item-title').textContent ?? ''
  ));
}

function itemSizes(): readonly string[] {
  return screen.getAllByTestId<HTMLSelectElement>('settings-custom-layout-size-select')
    .map((select) => select.value);
}

describe('CustomLayoutBuilder — shell', () => {
  it('renders an empty custom layout shell', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    expect(screen.getByTestId('settings-custom-layout-builder')).toBeInTheDocument();
    expect(screen.getByTestId('settings-custom-layout-count')).toHaveTextContent('0 / 12 items');
    expect(screen.getByTestId('settings-custom-layout-empty')).toBeInTheDocument();
    expect(screen.getByTestId('settings-custom-layout-preview-empty')).toBeInTheDocument();
  });

  it('adds custom layout item shells', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    // collapse the auto-expanded block before adding more
    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-divider'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-header-ticker'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-footer-ticker'));

    expect(screen.getByTestId('settings-custom-layout-count')).toHaveTextContent('4 / 12 items');
    expect(screen.getAllByTestId('settings-custom-layout-item')).toHaveLength(4);
    expect(itemTitles()).toEqual([
      'Metric block',
      'Divider',
      'Header ticker',
      'Footer ticker',
    ]);
    expect(itemSizes()).toEqual(['1x1', '3x1', '3x1', '3x1']);
  });

  it('moves custom layout items up and down', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand')); // collapse
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-divider'));

    expect(screen.getAllByTestId('settings-custom-layout-move-up')[0])
      .toHaveAccessibleName('Metric block is already first');
    expect(screen.getAllByTestId('settings-custom-layout-move-down')[1])
      .toHaveAccessibleName('Divider is already last');

    fireEvent.click(screen.getAllByTestId('settings-custom-layout-move-up')[1]);
    expect(itemTitles()).toEqual(['Divider', 'Metric block']);

    fireEvent.click(screen.getAllByTestId('settings-custom-layout-move-down')[0]);
    expect(itemTitles()).toEqual(['Metric block', 'Divider']);
  });

  it('updates tile sizes', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    const sizeSelect = screen.getByTestId<HTMLSelectElement>('settings-custom-layout-size-select');

    fireEvent.change(sizeSelect, { target: { value: '3x2' } });

    expect(sizeSelect.value).toBe('3x2');
  });

  it('enforces the phase 10 item limit', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    for (let index = 0; index < CUSTOM_LAYOUT_MAX_ITEMS; index += 1) {
      fireEvent.click(screen.getByTestId('settings-custom-layout-add-divider'));
    }

    expect(screen.getAllByTestId('settings-custom-layout-item')).toHaveLength(CUSTOM_LAYOUT_MAX_ITEMS);
    expect(screen.getByTestId('settings-custom-layout-limit')).toHaveTextContent(
      'Custom layouts are limited to 12 items.',
    );
    expect(screen.getByTestId('settings-custom-layout-add-divider')).toBeDisabled();
  });

  it('removes an item with the delete button', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-divider'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-divider'));
    expect(itemTitles()).toHaveLength(2);

    fireEvent.click(screen.getAllByTestId('settings-custom-layout-remove-item')[0]);
    expect(screen.getAllByTestId('settings-custom-layout-item')).toHaveLength(1);
    expect(screen.getByTestId('settings-custom-layout-count')).toHaveTextContent('1 / 12 items');
  });
});

describe('CustomLayoutBuilder — metric block editor', () => {
  it('auto-expands a newly added metric block', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));

    expect(screen.getByTestId('settings-custom-layout-block-editor')).toBeInTheDocument();
    expect(screen.getByTestId('settings-custom-layout-metrics-empty')).toBeInTheDocument();
  });

  it('collapses and re-expands a metric block', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    expect(screen.getByTestId('settings-custom-layout-block-editor')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));
    expect(screen.queryByTestId('settings-custom-layout-block-editor')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));
    expect(screen.getByTestId('settings-custom-layout-block-editor')).toBeInTheDocument();
  });

  it('updates the block name', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.change(screen.getByTestId('settings-custom-layout-block-name'), {
      target: { value: 'Comfort' },
    });

    expect(screen.getByTestId('settings-custom-layout-item-title')).toHaveTextContent('Comfort');
  });

  it('adds a metric and shows its label and station name', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));

    // Station picker should show the device name
    const stationSelect = screen.getByTestId<HTMLSelectElement>(
      'settings-custom-layout-metric-picker-station',
    );
    expect(stationSelect).toHaveValue(STATION_A.macAddress);
    expect(within(stationSelect).getByText(testDeviceName)).toBeInTheDocument();

    // Choose outdoor_temp and add
    fireEvent.change(screen.getByTestId('settings-custom-layout-metric-picker-key'), {
      target: { value: 'outdoor_temp' },
    });
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));

    const row = screen.getByTestId('settings-custom-layout-metric-row');
    expect(within(row).getByTestId('settings-custom-layout-metric-label')).toHaveTextContent(
      'Outdoor Temp',
    );
    expect(within(row).getByTestId('settings-custom-layout-metric-station')).toHaveTextContent(
      testDeviceName,
    );
  });

  it('shows nickname when device has one', () => {
    render(<CustomLayoutBuilder devices={[STATION_B]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));

    expect(screen.getByTestId('settings-custom-layout-metric-station')).toHaveTextContent('Garage');
  });

  it('shows station identity for each metric when two stations present', () => {
    render(<CustomLayoutBuilder devices={TWO_STATIONS} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));

    // Add a metric from station A
    fireEvent.change(screen.getByTestId('settings-custom-layout-metric-picker-station'), {
      target: { value: STATION_A.macAddress },
    });
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));

    // Add a metric from station B
    fireEvent.change(screen.getByTestId('settings-custom-layout-metric-picker-station'), {
      target: { value: STATION_B.macAddress },
    });
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));

    const rows = screen.getAllByTestId('settings-custom-layout-metric-row');
    expect(within(rows[0]).getByTestId('settings-custom-layout-metric-station')).toHaveTextContent(
      testDeviceName,
    );
    expect(within(rows[1]).getByTestId('settings-custom-layout-metric-station')).toHaveTextContent(
      'Garage',
    );
  });

  it('removes a metric from a block', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));
    expect(screen.getAllByTestId('settings-custom-layout-metric-row')).toHaveLength(2);

    fireEvent.click(screen.getAllByTestId('settings-custom-layout-metric-remove')[0]);
    expect(screen.getAllByTestId('settings-custom-layout-metric-row')).toHaveLength(1);
  });

  it('reorders metrics within a block', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));

    fireEvent.change(screen.getByTestId('settings-custom-layout-metric-picker-key'), {
      target: { value: 'outdoor_temp' },
    });
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));

    fireEvent.change(screen.getByTestId('settings-custom-layout-metric-picker-key'), {
      target: { value: 'outdoor_humidity' },
    });
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));

    const labelsBefore = screen.getAllByTestId('settings-custom-layout-metric-label')
      .map((el) => el.textContent);
    expect(labelsBefore).toEqual(['Outdoor Temp', 'Outdoor Humidity']);
    expect(screen.getAllByTestId('settings-custom-layout-metric-move-up')[0])
      .toHaveAccessibleName('Outdoor Temp is already first in this block');
    expect(screen.getAllByTestId('settings-custom-layout-metric-move-down')[1])
      .toHaveAccessibleName('Outdoor Humidity is already last in this block');

    // Move second metric up
    fireEvent.click(screen.getAllByTestId('settings-custom-layout-metric-move-up')[1]);

    const labelsAfter = screen.getAllByTestId('settings-custom-layout-metric-label')
      .map((el) => el.textContent);
    expect(labelsAfter).toEqual(['Outdoor Humidity', 'Outdoor Temp']);
  });
});

describe('CustomLayoutBuilder — divider editor', () => {
  it('updates optional divider labels', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-divider'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));

    fireEvent.change(screen.getByTestId('settings-custom-layout-divider-name'), {
      target: { value: 'Weather Bands' },
    });

    expect(screen.getByTestId('settings-custom-layout-item-title')).toHaveTextContent('Weather Bands');
    expect(screen.getByTestId('settings-custom-layout-item-summary')).toHaveTextContent('Named divider');

    fireEvent.change(screen.getByTestId('settings-custom-layout-divider-name'), {
      target: { value: '' },
    });

    expect(screen.getByTestId('settings-custom-layout-item-title')).toHaveTextContent('Divider');
    expect(screen.getByTestId('settings-custom-layout-item-summary')).toHaveTextContent('Blank divider');
  });
});

describe('CustomLayoutBuilder — fill tile mode', () => {
  it('disables fill mode when block has no metrics', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));

    expect(screen.getByTestId<HTMLInputElement>('settings-custom-layout-fill-mode')).toBeDisabled();
    expect(screen.getByTestId('settings-custom-layout-fill-warning')).toHaveTextContent(
      'Add at least one metric to enable fill mode.',
    );
  });

  it('enables fill mode when block has exactly one metric', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));

    expect(screen.getByTestId<HTMLInputElement>('settings-custom-layout-fill-mode')).not.toBeDisabled();
    expect(screen.queryByTestId('settings-custom-layout-fill-warning')).not.toBeInTheDocument();
  });

  it('disables fill mode and warns when block has more than one metric', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));

    expect(screen.getByTestId<HTMLInputElement>('settings-custom-layout-fill-mode')).toBeDisabled();
    expect(screen.getByTestId('settings-custom-layout-fill-warning')).toHaveTextContent(
      'Fill mode for a 1x1 block supports up to 1 metric',
    );
  });

  it('toggles fill mode on and off when one metric is present', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));

    const checkbox = screen.getByTestId<HTMLInputElement>('settings-custom-layout-fill-mode');
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });
});

describe('CustomLayoutBuilder — preview', () => {
  it('shows metric labels in the preview for a metric block', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.change(screen.getByTestId('settings-custom-layout-metric-picker-key'), {
      target: { value: 'outdoor_temp' },
    });
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));

    expect(screen.getByTestId('settings-custom-layout-preview-metric')).toHaveTextContent(
      'Outdoor Temp',
    );
  });

  it('shows the fill label large in the preview when fill mode is active', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.change(screen.getByTestId('settings-custom-layout-metric-picker-key'), {
      target: { value: 'indoor_temp' },
    });
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-fill-mode'));

    expect(screen.getByTestId('settings-custom-layout-preview-fill-label')).toHaveTextContent(
      'Indoor Temp',
    );
  });

  it('removes the preview tile when the item is deleted', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-divider'));
    expect(screen.getByTestId('settings-custom-layout-preview-item')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-custom-layout-remove-item'));
    expect(screen.getByTestId('settings-custom-layout-preview-empty')).toBeInTheDocument();
  });
});

describe('CustomLayoutBuilder — accessibility', () => {
  it('has no accessibility violations with empty builder', async () => {
    const { container } = render(<CustomLayoutBuilder devices={NO_DEVICES} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations with metric block and metrics', async () => {
    const { container } = render(<CustomLayoutBuilder devices={[STATION_A]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-metric-picker-add'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-divider'));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── Icon selection ────────────────────────────────────────────────────────────

describe('CustomLayoutBuilder — icon selection', () => {
  // Metric blocks auto-expand when added; this helper adds one and returns the expand toggle.
  function addBlock() {
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
  }

  it('selecting an icon on block 1 does not affect block 2', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    // Add block 1 (auto-expands). Set Thermometer icon.
    addBlock();
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Thermometer'));

    // Collapse block 1, add block 2 (auto-expands).
    fireEvent.click(screen.getAllByTestId('settings-custom-layout-item-expand')[0]);
    addBlock();

    // Block 2 is now expanded — position selector should NOT appear (no icon set).
    expect(screen.queryByTestId('settings-custom-layout-icon-position')).not.toBeInTheDocument();
  });

  it('icon picker shows position selector only when an icon is selected', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);
    addBlock();

    expect(screen.queryByTestId('settings-custom-layout-icon-position')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Wind'));
    expect(screen.getByTestId('settings-custom-layout-icon-position')).toBeInTheDocument();
  });

  it('icon selection persists when block is collapsed and re-expanded', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);
    addBlock();

    // Select an icon.
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Gauge'));

    // Collapse then re-expand.
    const expandBtn = screen.getByTestId('settings-custom-layout-item-expand');
    fireEvent.click(expandBtn);
    fireEvent.click(expandBtn);

    // Gauge button should be selected (aria-pressed true).
    expect(screen.getByTestId('settings-custom-layout-icon-Gauge')).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking the selected icon again deselects it and hides position selector', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);
    addBlock();

    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Sun'));
    expect(screen.getByTestId('settings-custom-layout-icon-position')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Sun'));
    expect(screen.queryByTestId('settings-custom-layout-icon-position')).not.toBeInTheDocument();
  });

  it('icon position defaults to Right and switches to Left', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);
    addBlock();
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Thermometer'));

    const rightBtn = screen.getByTestId('settings-custom-layout-icon-position-right');
    const leftBtn = screen.getByTestId('settings-custom-layout-icon-position-left');

    expect(rightBtn).toHaveAttribute('aria-pressed', 'true');
    expect(leftBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(leftBtn);
    expect(leftBtn).toHaveAttribute('aria-pressed', 'true');
    expect(rightBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('icon and position settings on two independent blocks are independent', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);

    // Add and configure block 1.
    addBlock();
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Thermometer'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-position-left'));

    // Collapse block 1, add block 2 (auto-expands).
    fireEvent.click(screen.getAllByTestId('settings-custom-layout-item-expand')[0]);
    addBlock();

    // Block 2: select Wind icon — no position selector from block 1 should leak.
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Wind'));
    expect(screen.getByTestId('settings-custom-layout-icon-Wind')).toHaveAttribute('aria-pressed', 'true');
    // Right is default for block 2 (not left from block 1).
    expect(screen.getByTestId('settings-custom-layout-icon-position-right')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('CustomLayoutBuilder — disconnected metric sources', () => {
  const DISCONNECTED_ITEMS: readonly CustomLayoutItem[] = [
    {
      id: 'custom-item-1',
      type: 'metric-block',
      name: 'Saved offline fields',
      size: '1x1',
      displayMode: 'rows',
      metrics: [
        {
          stationId: testDeviceIdColon,
          metricKey: 'outdoor_temp',
          labelOverride: null,
        },
      ],
      icon: null,
    },
  ];
  const PINNED_STATION: SettingsDeviceDto = {
    macAddress: 'pinned:WeatherGov:KGEN',
    name: '(Pinned) Generated pinned station',
    nickname: null,
    isPrimary: false,
    displayOnDashboard: true,
    selectedMetricKeys: null,
    latitude: null,
    longitude: null,
    elevationMeters: null,
    address: null,
    location: null,
    lastSyncAtUtc: null,
    sourceKind: 'pinned',
    provider: 'WeatherGov',
    sourceId: 'KGEN',
  };

  it('warns for saved metrics whose source is no longer available', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} initialItems={DISCONNECTED_ITEMS} />);

    expect(screen.getByTestId('settings-custom-layout-disconnected-warning'))
      .toHaveTextContent('1 saved custom layout field references disconnected source');

    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));

    expect(screen.getByTestId('settings-custom-layout-block-disconnected'))
      .toHaveTextContent('All fields in this block reference disconnected sources');
    expect(screen.getByTestId('settings-custom-layout-metric-disconnected'))
      .toHaveTextContent(`Reconnect ${testDeviceIdColon}`);
    expect(screen.getByTestId('settings-custom-layout-metric-label')).toHaveTextContent('Outdoor Temp');
    expect(screen.getByTestId('settings-custom-layout-metric-station')).toHaveTextContent(testDeviceIdColon);
  });

  it('preserves disconnected metric references when saving', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CustomLayoutBuilder
        devices={NO_DEVICES}
        initialItems={DISCONNECTED_ITEMS}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId('settings-custom-layout-save'));

    await waitFor(() => { expect(onSave).toHaveBeenCalledOnce(); });
    expect(onSave).toHaveBeenCalledWith(DISCONNECTED_ITEMS);
  });

  it('only warns on missing sources in a mixed block and keeps missing sources out of the picker', () => {
    const items: readonly CustomLayoutItem[] = [
      {
        id: 'custom-item-1',
        type: 'metric-block',
        name: 'Mixed fields',
        size: '2x1',
        displayMode: 'rows',
        metrics: [
          {
            stationId: STATION_A.macAddress,
            metricKey: 'outdoor_temp',
            labelOverride: null,
          },
          {
            stationId: 'public:WeatherGov:REMOVED',
            metricKey: 'outdoor_humidity',
            labelOverride: null,
          },
        ],
        icon: null,
      },
    ];

    render(<CustomLayoutBuilder devices={[STATION_A]} initialItems={items} />);

    expect(screen.getByTestId('settings-custom-layout-disconnected-warning'))
      .toHaveTextContent('1 saved custom layout field references disconnected source');

    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));

    expect(screen.queryByTestId('settings-custom-layout-block-disconnected')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('settings-custom-layout-metric-disconnected')).toHaveLength(1);

    const stationPicker = screen.getByTestId<HTMLSelectElement>('settings-custom-layout-metric-picker-station');
    const options = Array.from(stationPicker.options).map((option) => option.value);
    expect(options).toEqual([STATION_A.macAddress]);
    expect(options).not.toContain('public:WeatherGov:REMOVED');
  });

  it('does not warn when saved metric sources are available', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} initialItems={DISCONNECTED_ITEMS} />);

    expect(screen.queryByTestId('settings-custom-layout-disconnected-warning')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));

    expect(screen.queryByTestId('settings-custom-layout-block-disconnected')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-custom-layout-metric-disconnected')).not.toBeInTheDocument();
  });

  it('does not warn for a connected pinned source', () => {
    const items: readonly CustomLayoutItem[] = [
      {
        id: 'custom-item-1',
        type: 'metric-block',
        name: 'Pinned fields',
        size: '1x1',
        displayMode: 'rows',
        metrics: [
          {
            stationId: 'pinned:weathergov:kgen',
            metricKey: 'outdoor_temp',
            labelOverride: null,
          },
        ],
        icon: null,
      },
    ];

    render(<CustomLayoutBuilder devices={[PINNED_STATION]} initialItems={items} />);

    expect(screen.queryByTestId('settings-custom-layout-disconnected-warning')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));

    expect(screen.queryByTestId('settings-custom-layout-metric-disconnected')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-custom-layout-metric-station')).toHaveTextContent('(Pinned) Generated pinned station');
  });

  it('waits for source inventory before warning on missing external sources', () => {
    render(
      <CustomLayoutBuilder
        devices={NO_DEVICES}
        initialItems={[{
          id: 'custom-item-1',
          type: 'metric-block',
          name: 'Pinned fields',
          size: '1x1',
          displayMode: 'rows',
          metrics: [{
            stationId: PINNED_STATION.macAddress,
            metricKey: 'outdoor_temp',
            labelOverride: null,
          }],
          icon: null,
        }]}
        isSourceInventoryLoading
      />,
    );

    expect(screen.queryByTestId('settings-custom-layout-disconnected-warning')).not.toBeInTheDocument();
  });

  it('warns for owned station fields when Ambient credentials are missing even if cached device metadata exists', () => {
    render(
      <CustomLayoutBuilder
        devices={[STATION_A]}
        initialItems={DISCONNECTED_ITEMS}
        hasAmbientCredentials={false}
      />,
    );

    expect(screen.getByTestId('settings-custom-layout-disconnected-warning'))
      .toHaveTextContent('1 saved custom layout field references disconnected source');

    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));

    expect(screen.getByTestId('settings-custom-layout-metric-disconnected'))
      .toHaveTextContent(`Reconnect ${testDeviceIdColon}`);
  });

  it('does not offer owned stations in the picker when Ambient credentials are missing', () => {
    render(
      <CustomLayoutBuilder
        devices={[STATION_A, PINNED_STATION]}
        initialItems={DISCONNECTED_ITEMS}
        hasAmbientCredentials={false}
      />,
    );

    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));

    const stationPicker = screen.getByTestId<HTMLSelectElement>('settings-custom-layout-metric-picker-station');
    const options = Array.from(stationPicker.options).map((option) => option.value);
    expect(options).toEqual([PINNED_STATION.macAddress]);
    expect(options).not.toContain(STATION_A.macAddress);
  });
});

// ── Save payload ─────────────────────────────────────────────────────────────

describe('CustomLayoutBuilder — save payload', () => {
  it('includes icon and iconPosition in onSave payload', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CustomLayoutBuilder devices={[STATION_A]} onSave={onSave} />);

    // Add a block (auto-expands), set Thermometer icon, Left position.
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Thermometer'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-position-left'));

    // Save.
    fireEvent.click(screen.getByTestId('settings-custom-layout-save'));

    await waitFor(() => { expect(onSave).toHaveBeenCalledOnce(); });

    const [savedItems] = onSave.mock.calls[0] as [{ icon?: string; iconPosition?: string }[]];
    expect(savedItems).toHaveLength(1);
    expect(savedItems[0]).toMatchObject({ icon: 'Thermometer', iconPosition: 'left' });
  });

  it('saves two blocks with independent icons and positions', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CustomLayoutBuilder devices={[STATION_A]} onSave={onSave} />);

    // Block 1: Thermometer, Left.
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Thermometer'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-position-left'));

    // Collapse block 1, add block 2: Wind, Right (default).
    fireEvent.click(screen.getAllByTestId('settings-custom-layout-item-expand')[0]);
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));
    fireEvent.click(screen.getByTestId('settings-custom-layout-icon-Wind'));

    // Save.
    fireEvent.click(screen.getByTestId('settings-custom-layout-save'));

    await waitFor(() => { expect(onSave).toHaveBeenCalledOnce(); });

    const [savedItems] = onSave.mock.calls[0] as [{ icon?: string; iconPosition?: string }[]];
    expect(savedItems).toHaveLength(2);
    expect(savedItems[0]).toMatchObject({ icon: 'Thermometer', iconPosition: 'left' });
    expect(savedItems[1]).toMatchObject({ icon: 'Wind' });
    expect(savedItems[1].iconPosition).not.toBe('left');
  });
});

// ── Pinned station station picker ─────────────────────────────────────────────

describe('CustomLayoutBuilder — pinned station metric picker', () => {
  const PINNED_STATION: SettingsDeviceDto = {
    macAddress: 'pinned:WeatherGov:KGEN',
    name: '(Pinned) Generated pinned station',
    nickname: null,
    isPrimary: false,
    displayOnDashboard: true,
    selectedMetricKeys: null,
    latitude: null,
    longitude: null,
    elevationMeters: null,
    address: null,
    location: null,
    lastSyncAtUtc: null,
    sourceKind: 'pinned',
    provider: 'WeatherGov',
    sourceId: 'KGEN',
  };

  it('shows pinned station in the station picker dropdown', () => {
    render(<CustomLayoutBuilder devices={[STATION_A, PINNED_STATION]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));

    const stationPicker = screen.getByTestId<HTMLSelectElement>('settings-custom-layout-metric-picker-station');
    const options = Array.from(stationPicker.options).map((o) => o.text);
    expect(options).toContain('(Pinned) Generated pinned station');
    expect(screen.getByTestId('settings-custom-layout-metric-picker-source-kind')).toHaveTextContent('Owned station');

    fireEvent.change(stationPicker, { target: { value: PINNED_STATION.macAddress } });

    expect(screen.getByTestId('settings-custom-layout-metric-picker-source-kind')).toHaveTextContent('Pinned source');
    expect(screen.getByTestId('settings-custom-layout-metric-picker-provider-badge')).toHaveTextContent('Weather.gov');
  });

  it('restricts metric picker to outdoor-only keys when pinned station is selected', () => {
    render(<CustomLayoutBuilder devices={[PINNED_STATION]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));

    const metricPicker = screen.getByTestId<HTMLSelectElement>('settings-custom-layout-metric-picker-key');
    const keys = Array.from(metricPicker.options).map((o) => o.value);

    // Outdoor metrics are available
    expect(keys).toContain('outdoor_temp');
    expect(keys).toContain('outdoor_humidity');
    expect(keys).toContain('wind_speed');

    // Indoor metrics are excluded
    expect(keys).not.toContain('indoor_temp');
    expect(keys).not.toContain('indoor_humidity');
    expect(keys).not.toContain('max_daily_gust');
  });
});

describe('CustomLayoutBuilder — public source metric picker', () => {
  it('shows public source provenance and hides unsupported metrics', () => {
    render(<CustomLayoutBuilder devices={[STATION_A, PUBLIC_PICKER_SOURCE]} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-metric-block'));

    const stationPicker = screen.getByTestId<HTMLSelectElement>('settings-custom-layout-metric-picker-station');
    fireEvent.change(stationPicker, { target: { value: PUBLIC_PICKER_SOURCE.macAddress } });

    expect(screen.getByTestId('settings-custom-layout-metric-picker-source-kind')).toHaveTextContent('Public source');
    expect(screen.getByTestId('settings-custom-layout-metric-picker-provider-badge')).toHaveTextContent('Weather.gov');

    const metricPicker = screen.getByTestId<HTMLSelectElement>('settings-custom-layout-metric-picker-key');
    const keys = Array.from(metricPicker.options).map((o) => o.value);
    expect(keys).toContain('nws_text_description');
    expect(keys).not.toContain('indoor_temp');
  });
});

// ── TickerEditor ─────────────────────────────────────────────────────────────

const PUBLIC_SOURCE: SettingsDeviceDto = {
  macAddress: 'public:WeatherGov:KABC',
  name: 'Weather.gov KABC',
  nickname: null,
  isPrimary: false,
  displayOnDashboard: true,
  selectedMetricKeys: null,
  latitude: null,
  longitude: null,
  elevationMeters: null,
  address: null,
  location: null,
  lastSyncAtUtc: null,
  sourceKind: 'public',
  provider: 'WeatherGov',
  sourceId: 'KABC',
};

describe('CustomLayoutBuilder — ticker editor', () => {
  function addTicker() {
    fireEvent.click(screen.getByTestId('settings-custom-layout-add-header-ticker'));
    // Expand the ticker so the editor is visible
    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));
  }

  it('expands and collapses a ticker item', () => {
    render(<CustomLayoutBuilder devices={NO_DEVICES} />);

    fireEvent.click(screen.getByTestId('settings-custom-layout-add-header-ticker'));
    expect(screen.queryByTestId('settings-custom-layout-ticker-editor')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));
    expect(screen.getByTestId('settings-custom-layout-ticker-editor')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('settings-custom-layout-item-expand'));
    expect(screen.queryByTestId('settings-custom-layout-ticker-editor')).not.toBeInTheDocument();
  });

  it('shows Own Station as default channel option', () => {
    render(<CustomLayoutBuilder devices={[STATION_A]} />);
    addTicker();

    const channelSelect = screen.getByTestId<HTMLSelectElement>(
      'settings-custom-layout-ticker-channel',
    );
    expect(channelSelect.value).toBe('');
    expect(within(channelSelect).getByText('Own Station')).toBeInTheDocument();
  });

  it('lists public sources in the channel dropdown', () => {
    render(<CustomLayoutBuilder devices={[STATION_A, PUBLIC_SOURCE]} />);
    addTicker();

    const channelSelect = screen.getByTestId<HTMLSelectElement>(
      'settings-custom-layout-ticker-channel',
    );
    const options = Array.from(channelSelect.options).map((o) => o.text);
    expect(options).toContain('Weather.gov KABC');
    expect(options).not.toContain(testDeviceName); // owned stations not in channel list
  });

  it('changing channel select updates the item in the save payload', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CustomLayoutBuilder devices={[STATION_A, PUBLIC_SOURCE]} onSave={onSave} />);
    addTicker();

    fireEvent.change(screen.getByTestId('settings-custom-layout-ticker-channel'), {
      target: { value: PUBLIC_SOURCE.macAddress },
    });

    fireEvent.click(screen.getByTestId('settings-custom-layout-save'));
    await waitFor(() => { expect(onSave).toHaveBeenCalledOnce(); });

    const [savedItems] = onSave.mock.calls[0] as [{ channelStationId?: string | null }[]];
    expect(savedItems[0]).toMatchObject({ channelStationId: PUBLIC_SOURCE.macAddress });
  });

  it('resetting channel select to Own Station sets channelStationId to null', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CustomLayoutBuilder devices={[STATION_A, PUBLIC_SOURCE]} onSave={onSave} />);
    addTicker();

    fireEvent.change(screen.getByTestId('settings-custom-layout-ticker-channel'), {
      target: { value: PUBLIC_SOURCE.macAddress },
    });
    fireEvent.change(screen.getByTestId('settings-custom-layout-ticker-channel'), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByTestId('settings-custom-layout-save'));
    await waitFor(() => { expect(onSave).toHaveBeenCalledOnce(); });

    const [savedItems] = onSave.mock.calls[0] as [{ channelStationId?: string | null }[]];
    expect(savedItems[0].channelStationId).toBeNull();
  });

  it('entering an alerts zone uppercases the value and saves it', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CustomLayoutBuilder devices={NO_DEVICES} onSave={onSave} />);
    addTicker();

    fireEvent.change(screen.getByTestId('settings-custom-layout-ticker-zone'), {
      target: { value: 'nyz072' },
    });

    fireEvent.click(screen.getByTestId('settings-custom-layout-save'));
    await waitFor(() => { expect(onSave).toHaveBeenCalledOnce(); });

    const [savedItems] = onSave.mock.calls[0] as [{ alertsZone?: string | null }[]];
    expect(savedItems[0].alertsZone).toBe('NYZ072');
  });

  it('clearing the alerts zone sets it to null', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CustomLayoutBuilder devices={NO_DEVICES} onSave={onSave} />);
    addTicker();

    fireEvent.change(screen.getByTestId('settings-custom-layout-ticker-zone'), {
      target: { value: 'NYZ072' },
    });
    fireEvent.change(screen.getByTestId('settings-custom-layout-ticker-zone'), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByTestId('settings-custom-layout-save'));
    await waitFor(() => { expect(onSave).toHaveBeenCalledOnce(); });

    const [savedItems] = onSave.mock.calls[0] as [{ alertsZone?: string | null }[]];
    expect(savedItems[0].alertsZone).toBeNull();
  });

  it('weather-field checkboxes toggle sourceLabels', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CustomLayoutBuilder devices={NO_DEVICES} onSave={onSave} />);
    addTicker();

    fireEvent.click(screen.getByTestId('settings-custom-layout-ticker-label-outdoor_temp'));

    fireEvent.click(screen.getByTestId('settings-custom-layout-save'));
    await waitFor(() => { expect(onSave).toHaveBeenCalledOnce(); });

    const [savedItems] = onSave.mock.calls[0] as [{ sourceLabels?: readonly string[] }[]];
    expect(savedItems[0].sourceLabels).toContain('outdoor_temp');
  });
});
