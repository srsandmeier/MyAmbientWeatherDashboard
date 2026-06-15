import type { MetricKey } from './settings';

export const CUSTOM_LAYOUT_MAX_ITEMS = 12;

export const CUSTOM_LAYOUT_TILE_SIZES = [
  '1x1',
  '1x2',
  '1x3',
  '2x1',
  '2x2',
  '2x3',
  '3x1',
  '3x2',
  '3x3',
] as const;

export const CUSTOM_LAYOUT_ITEM_TYPES = [
  'metric-block',
  'divider',
  'header-ticker',
  'footer-ticker',
] as const;

export type LayoutMode = 'default' | 'custom';
export type CustomLayoutTileSize = typeof CUSTOM_LAYOUT_TILE_SIZES[number];
export type CustomLayoutItemType = typeof CUSTOM_LAYOUT_ITEM_TYPES[number];
export type CustomMetricBlockDisplayMode = 'rows' | 'fill';
export type CustomTickerPosition = 'header' | 'footer';

export interface CustomMetricReference {
  readonly stationId: string;
  readonly metricKey: MetricKey;
  readonly labelOverride?: string | null;
}

export type CustomBlockIconPosition = 'left' | 'right';

export interface CustomMetricBlockItem {
  readonly id: string;
  readonly type: 'metric-block';
  readonly name: string;
  readonly size: CustomLayoutTileSize;
  readonly displayMode: CustomMetricBlockDisplayMode;
  readonly metrics: readonly CustomMetricReference[];
  readonly icon?: string | null;
  readonly iconPosition?: CustomBlockIconPosition;
}

export interface CustomDividerItem {
  readonly id: string;
  readonly type: 'divider';
  readonly name: string | null;
  readonly size: CustomLayoutTileSize;
}

export interface CustomTickerItem {
  readonly id: string;
  readonly type: 'header-ticker' | 'footer-ticker';
  readonly name: string | null;
  readonly position: CustomTickerPosition;
  readonly size: CustomLayoutTileSize;
  readonly sourceLabels: readonly string[];
  readonly isPaused: boolean;
  /** Station id whose reading the ticker should display. null = own station (default). */
  readonly channelStationId?: string | null;
  /** NWS area/zone/state code for alert content override. null = dashboard-level selection. */
  readonly alertsZone?: string | null;
}

export type CustomLayoutItem =
  | CustomMetricBlockItem
  | CustomDividerItem
  | CustomTickerItem;

export interface CustomLayoutValidationResult {
  readonly isValid: boolean;
  readonly messages: readonly string[];
}

export function isCustomLayoutTileSize(size: string): size is CustomLayoutTileSize {
  return CUSTOM_LAYOUT_TILE_SIZES.some((candidate) => candidate === size);
}

export function getDefaultCustomLayoutSize(type: CustomLayoutItemType): CustomLayoutTileSize {
  if (type === 'divider' || type === 'header-ticker' || type === 'footer-ticker') {
    return '3x1';
  }

  return '1x1';
}

export function createCustomLayoutItem(
  type: CustomLayoutItemType,
  id: string,
): CustomLayoutItem {
  if (type === 'divider') {
    return {
      id,
      type,
      name: null,
      size: getDefaultCustomLayoutSize(type),
    };
  }

  if (type === 'header-ticker' || type === 'footer-ticker') {
    return {
      id,
      type,
      name: type === 'header-ticker' ? 'Header ticker' : 'Footer ticker',
      position: type === 'header-ticker' ? 'header' : 'footer',
      size: getDefaultCustomLayoutSize(type),
      sourceLabels: [],
      isPaused: true,
      channelStationId: null,
      alertsZone: null,
    };
  }

  return {
    id,
    type,
    name: '',
    size: getDefaultCustomLayoutSize(type),
    displayMode: 'rows',
    metrics: [],
    icon: null,
  };
}

export function updateCustomLayoutItemSize(
  item: CustomLayoutItem,
  size: CustomLayoutTileSize,
): CustomLayoutItem {
  return { ...item, size };
}

export function removeCustomLayoutItem(
  items: readonly CustomLayoutItem[],
  id: string,
): readonly CustomLayoutItem[] {
  return items.filter((item) => item.id !== id);
}

export function addMetricToBlock(
  item: CustomMetricBlockItem,
  metric: CustomMetricReference,
): CustomMetricBlockItem {
  return { ...item, metrics: [...item.metrics, metric] };
}

export function removeMetricFromBlock(
  item: CustomMetricBlockItem,
  metricIndex: number,
): CustomMetricBlockItem {
  return { ...item, metrics: item.metrics.filter((_, i) => i !== metricIndex) };
}

export function moveMetricInBlock(
  item: CustomMetricBlockItem,
  metricIndex: number,
  direction: 'up' | 'down',
): CustomMetricBlockItem {
  const nextIndex = direction === 'up' ? metricIndex - 1 : metricIndex + 1;
  if (nextIndex < 0 || nextIndex >= item.metrics.length) return item;
  const next = [...item.metrics];
  [next[metricIndex], next[nextIndex]] = [next[nextIndex], next[metricIndex]];
  return { ...item, metrics: next };
}

export function setBlockDisplayMode(
  item: CustomMetricBlockItem,
  mode: CustomMetricBlockDisplayMode,
): CustomMetricBlockItem {
  return { ...item, displayMode: mode };
}

export function setBlockName(
  item: CustomMetricBlockItem,
  name: string,
): CustomMetricBlockItem {
  return { ...item, name };
}

export function setDividerName(
  item: CustomDividerItem,
  name: string,
): CustomDividerItem {
  const trimmed = name.trim();
  return { ...item, name: trimmed.length > 0 ? trimmed : null };
}

export function setBlockIcon(
  item: CustomMetricBlockItem,
  icon: string | null,
): CustomMetricBlockItem {
  return { ...item, icon };
}

export function setBlockIconPosition(
  item: CustomMetricBlockItem,
  iconPosition: CustomBlockIconPosition,
): CustomMetricBlockItem {
  return { ...item, iconPosition };
}

/** Number of 1×1 cells a tile of the given size contains (col × row). */
export function fillCapacity(size: CustomLayoutTileSize): number {
  return parseInt(size.charAt(0), 10) * parseInt(size.charAt(2), 10);
}

export function validateCustomLayoutItems(
  items: readonly CustomLayoutItem[],
): CustomLayoutValidationResult {
  const messages: string[] = [];

  if (items.length > CUSTOM_LAYOUT_MAX_ITEMS) {
    messages.push(`Custom layout can include at most ${CUSTOM_LAYOUT_MAX_ITEMS.toString()} items.`);
  }

  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) {
      messages.push('Custom layout item ids must be unique.');
      break;
    }
    ids.add(item.id);

    if (!isCustomLayoutTileSize(item.size)) {
      messages.push(`Custom layout item ${item.id} has an unsupported tile size.`);
    }

    if (item.type === 'metric-block' && item.displayMode === 'fill') {
      const capacity = fillCapacity(item.size);
      if (item.metrics.length < 1 || item.metrics.length > capacity) {
        messages.push(
          `Fill tile mode for a ${item.size} block requires 1 to ${capacity.toString()} metric${capacity !== 1 ? 's' : ''}.`,
        );
      }
    }

    if (item.type === 'header-ticker' && item.position !== 'header') {
      messages.push('Header ticker items must use the header position.');
    }

    if (item.type === 'footer-ticker' && item.position !== 'footer') {
      messages.push('Footer ticker items must use the footer position.');
    }
  }

  return {
    isValid: messages.length === 0,
    messages,
  };
}
