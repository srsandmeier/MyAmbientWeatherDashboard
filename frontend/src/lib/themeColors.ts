/**
 * Theme tokens as colours a canvas library can use, and the OKLCH maths behind them. ECharts (zrender)
 * draws on a canvas and parses colours itself: it reads neither CSS variables nor `oklch()`, so tokens are
 * read from the document and converted to `rgb()`.
 *
 * scripts/contrast-tokens.mjs imports this file too (Node strips the types), so the contrast that CI
 * checks and the colours the chart draws come from one conversion. Keep it free of imports and of
 * TypeScript syntax that cannot be erased (enums, namespaces, parameter properties).
 */

export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

// `oklch(L C h)` with L as a number or a percentage, an optional `deg` on the hue and an optional alpha.
const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/i;

/** Parses an `oklch()` value, or undefined for anything else. */
export function parseOklch(value: string): Oklch | undefined {
  const match = OKLCH.exec(value.trim());
  if (!match) return undefined;
  const [, l, percent, c, h] = match;
  return { l: Number(l) / (percent ? 100 : 1), c: Number(c), h: Number(h) };
}

/** Linear sRGB channels (0–1) of an OKLCH colour, clipped to the sRGB gamut. */
export function oklchToLinearRgb({ l, c, h }: Oklch): readonly [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (v: number): number => Math.min(1, Math.max(0, v));
  return [
    clip(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc),
    clip(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc),
    clip(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc),
  ];
}

const encode = (linear: number): number => Math.round(255 * (linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055));

/** Converts an OKLCH colour to an `rgb()` string, clipped to the sRGB gamut. */
export function oklchToRgb(color: Oklch): string {
  const [r, g, b] = oklchToLinearRgb(color).map(encode);
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

/** A CSS colour value as one a canvas library parses: `oklch()` becomes `rgb()`, anything else is kept. */
export function toCanvasColor(value: string): string {
  const color = parseOklch(value);
  return color ? oklchToRgb(color) : value.trim();
}

/** The theme token `--<name>` from a computed style as a canvas colour, or undefined when it is not set. */
export function readThemeColor(style: CSSStyleDeclaration, name: string): string | undefined {
  const value = style.getPropertyValue(`--${name}`);
  return value.trim() === '' ? undefined : toCanvasColor(value);
}
