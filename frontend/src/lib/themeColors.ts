/**
 * Theme tokens as colours a canvas library can use. ECharts (zrender) draws on a canvas and parses
 * colours itself: it reads neither CSS variables nor `oklch()`, so tokens are read from the document and
 * converted to `rgb()`. The OKLCH conversion matches scripts/contrast-tokens.mjs.
 */

const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.%]+\s*)?\)$/i;

const encode = (linear: number): number => {
  const v = Math.min(1, Math.max(0, linear));
  return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
};

/** Converts an OKLCH colour to an `rgb()` string, clipped to the sRGB gamut. */
export function oklchToRgb(l: number, c: number, h: number): string {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = encode(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc);
  const g = encode(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc);
  const bl = encode(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc);
  return `rgb(${String(r)}, ${String(g)}, ${String(bl)})`;
}

/** A CSS colour value as one a canvas library parses: `oklch()` becomes `rgb()`, anything else is kept. */
export function toCanvasColor(value: string): string {
  const match = OKLCH.exec(value.trim());
  if (!match) return value.trim();
  const [, l, percent, c, h] = match;
  return oklchToRgb(Number(l) / (percent ? 100 : 1), Number(c), Number(h));
}

/** The current value of the theme token `--<name>` as a canvas colour, or undefined when it is not set. */
export function readThemeColor(name: string, root: Element = document.documentElement): string | undefined {
  const value = getComputedStyle(root).getPropertyValue(`--${name}`);
  return value.trim() === '' ? undefined : toCanvasColor(value);
}
