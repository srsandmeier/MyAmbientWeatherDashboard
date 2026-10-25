import { afterEach, describe, expect, it } from 'vitest';
import { oklchToRgb, readThemeColor, toCanvasColor } from './themeColors';

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('oklchToRgb', () => {
  it('converts white, black and a neutral grey', () => {
    expect(oklchToRgb(1, 0, 0)).toBe('rgb(255, 255, 255)');
    expect(oklchToRgb(0, 0, 0)).toBe('rgb(0, 0, 0)');
    // Neutral L = 0.6 is linear 0.6³ = 0.216, which sRGB-encodes to 0.502.
    expect(oklchToRgb(0.6, 0, 0)).toBe('rgb(128, 128, 128)');
  });

  it('keeps hue: a red OKLCH colour has more red than blue', () => {
    const [r, g, b] = /rgb\((\d+), (\d+), (\d+)\)/.exec(oklchToRgb(0.6, 0.2, 25))?.slice(1).map(Number) ?? [];
    expect(r).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(g);
  });

  it('clips colours outside the sRGB gamut to 0–255', () => {
    expect(oklchToRgb(0.95, 0.4, 140)).toMatch(/^rgb\((\d{1,3}), (\d{1,3}), (\d{1,3})\)$/);
    for (const channel of /rgb\((.*)\)/.exec(oklchToRgb(0.95, 0.4, 140))?.[1].split(', ').map(Number) ?? []) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });
});

describe('toCanvasColor', () => {
  it('converts oklch() with a plain or percentage lightness, a deg hue and an alpha', () => {
    expect(toCanvasColor(' oklch(1 0 0) ')).toBe('rgb(255, 255, 255)');
    expect(toCanvasColor('oklch(100% 0 0)')).toBe('rgb(255, 255, 255)');
    expect(toCanvasColor('oklch(0.6 0 0deg / 50%)')).toBe('rgb(128, 128, 128)');
  });

  it('keeps colours a canvas library already parses', () => {
    expect(toCanvasColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
    expect(toCanvasColor('  #123456 ')).toBe('#123456');
  });
});

describe('readThemeColor', () => {
  it('reads a token from the document as a canvas colour', () => {
    document.documentElement.style.setProperty('--chart-1', 'oklch(1 0 0)');
    expect(readThemeColor('chart-1')).toBe('rgb(255, 255, 255)');
  });

  it('is undefined for a token that is not set', () => {
    expect(readThemeColor('chart-9')).toBeUndefined();
  });
});
