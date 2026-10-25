import { afterEach, describe, expect, it } from 'vitest';
import { oklchToLinearRgb, oklchToRgb, parseOklch, readThemeColor, toCanvasColor } from './themeColors';

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('parseOklch', () => {
  it('reads a plain or percentage lightness, a deg hue and an alpha', () => {
    expect(parseOklch('oklch(0.5 0.17 255)')).toEqual({ l: 0.5, c: 0.17, h: 255 });
    expect(parseOklch(' oklch(72% 0.14 255deg / 50%) ')).toEqual({ l: 0.72, c: 0.14, h: 255 });
    expect(parseOklch('oklch(0.5 0.1 20 / 0.4)')).toEqual({ l: 0.5, c: 0.1, h: 20 });
  });

  it('is undefined for other colour formats', () => {
    expect(parseOklch('#123456')).toBeUndefined();
    expect(parseOklch('hsl(0 0% 50%)')).toBeUndefined();
  });
});

describe('oklchToRgb', () => {
  it('converts white, black and a neutral grey', () => {
    expect(oklchToRgb({ l: 1, c: 0, h: 0 })).toBe('rgb(255, 255, 255)');
    expect(oklchToRgb({ l: 0, c: 0, h: 0 })).toBe('rgb(0, 0, 0)');
    // Neutral L = 0.6 is linear 0.6³ = 0.216, which sRGB-encodes to 0.502.
    expect(oklchToRgb({ l: 0.6, c: 0, h: 0 })).toBe('rgb(128, 128, 128)');
  });

  it('keeps hue: a red OKLCH colour has more red than green or blue', () => {
    const [r, g, b] = oklchToLinearRgb({ l: 0.6, c: 0.2, h: 25 });
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it('clips colours outside the sRGB gamut to 0–1', () => {
    for (const channel of oklchToLinearRgb({ l: 0.95, c: 0.4, h: 140 })) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });
});

describe('toCanvasColor', () => {
  it('converts oklch() and keeps colours a canvas library already parses', () => {
    expect(toCanvasColor('oklch(100% 0 0)')).toBe('rgb(255, 255, 255)');
    expect(toCanvasColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
    expect(toCanvasColor('  #123456 ')).toBe('#123456');
  });
});

describe('readThemeColor', () => {
  it('reads a token from a computed style as a canvas colour', () => {
    document.documentElement.style.setProperty('--chart-1', 'oklch(1 0 0)');
    expect(readThemeColor(getComputedStyle(document.documentElement), 'chart-1')).toBe('rgb(255, 255, 255)');
  });

  it('is undefined for a token that is not set', () => {
    expect(readThemeColor(getComputedStyle(document.documentElement), 'chart-9')).toBeUndefined();
  });
});
