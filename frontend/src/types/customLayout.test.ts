import { describe, expect, it } from 'vitest';
import {
  CUSTOM_LAYOUT_MAX_ITEMS,
  CUSTOM_LAYOUT_TILE_SIZES,
  createCustomLayoutItem,
  getDefaultCustomLayoutSize,
  isCustomLayoutTileSize,
  updateCustomLayoutItemSize,
  validateCustomLayoutItems,
  type CustomLayoutItem,
} from './customLayout';

describe('customLayout types and helpers', () => {
  it('defines the allowed 3-column tile sizes', () => {
    expect(CUSTOM_LAYOUT_TILE_SIZES).toEqual([
      '1x1',
      '1x2',
      '1x3',
      '2x1',
      '2x2',
      '2x3',
      '3x1',
      '3x2',
      '3x3',
    ]);
  });

  it('identifies valid tile sizes', () => {
    expect(isCustomLayoutTileSize('3x2')).toBe(true);
    expect(isCustomLayoutTileSize('4x1')).toBe(false);
  });

  it('defaults full-row utility items to 3x1', () => {
    expect(getDefaultCustomLayoutSize('metric-block')).toBe('1x1');
    expect(getDefaultCustomLayoutSize('divider')).toBe('3x1');
    expect(getDefaultCustomLayoutSize('header-ticker')).toBe('3x1');
    expect(getDefaultCustomLayoutSize('footer-ticker')).toBe('3x1');
  });

  it('creates custom layout item shells', () => {
    expect(createCustomLayoutItem('metric-block', 'item-1')).toMatchObject({
      id: 'item-1',
      type: 'metric-block',
      name: '',
      size: '1x1',
      displayMode: 'rows',
      metrics: [],
    });
    expect(createCustomLayoutItem('divider', 'item-2')).toMatchObject({
      id: 'item-2',
      type: 'divider',
      name: null,
      size: '3x1',
    });
    expect(createCustomLayoutItem('header-ticker', 'item-3')).toMatchObject({
      id: 'item-3',
      type: 'header-ticker',
      position: 'header',
      size: '3x1',
      isPaused: true,
    });
  });

  it('updates item size immutably', () => {
    const item = createCustomLayoutItem('metric-block', 'item-1');
    const updated = updateCustomLayoutItemSize(item, '2x3');

    expect(updated).toMatchObject({ size: '2x3' });
    expect(item).toMatchObject({ size: '1x1' });
  });

  it('validates max items and duplicate ids', () => {
    const items = Array.from({ length: CUSTOM_LAYOUT_MAX_ITEMS + 1 }, (_value, index) => (
      createCustomLayoutItem('divider', `item-${index.toString()}`)
    ));

    expect(validateCustomLayoutItems(items).messages).toContain(
      'Custom layout can include at most 12 items.',
    );

    const duplicateItems = [
      createCustomLayoutItem('divider', 'duplicate'),
      createCustomLayoutItem('metric-block', 'duplicate'),
    ];

    expect(validateCustomLayoutItems(duplicateItems).messages).toContain(
      'Custom layout item ids must be unique.',
    );
  });

  it('validates fill mode and ticker positions', () => {
    const baseFillItem = createCustomLayoutItem('metric-block', 'item-1');
    const baseHeaderItem = createCustomLayoutItem('header-ticker', 'item-2');
    if (baseFillItem.type !== 'metric-block' || baseHeaderItem.type !== 'header-ticker') {
      throw new Error('Unexpected custom layout item factory result.');
    }

    const fillItem: CustomLayoutItem = {
      ...baseFillItem,
      displayMode: 'fill',
      metrics: [],
    };
    const headerItem: CustomLayoutItem = {
      ...baseHeaderItem,
      position: 'footer',
    };

    expect(validateCustomLayoutItems([fillItem, headerItem]).messages).toEqual([
      'Fill tile mode for a 1x1 block requires 1 to 1 metric.',
      'Header ticker items must use the header position.',
    ]);
  });
});
