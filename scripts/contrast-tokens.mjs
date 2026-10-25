// WCAG contrast of the theme tokens in frontend/src/index.css, light (:root) and dark (.dark), with no
// browser (.claude/skills/contrast-tokens/SKILL.md). Every `--x-foreground` is checked on its `--x`, and
// body and muted text on every surface it is drawn on. Text needs 4.5:1 (WCAG 1.4.3); the focus ring and
// the `--chart-N` series need 3:1 (1.4.11). Input borders at 3:1 are advisory: a field can be identified by
// other cues. A colour token the check cannot read fails, so none drops out of the check unnoticed. The
// OKLCH parsing and conversion come from frontend/src/lib/themeColors.ts (Node strips its types), the same
// code the chart draws with.
//
//   node scripts/contrast-tokens.mjs    # one line per failing pair, then the totals; exits 1 on a failure

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { oklchToLinearRgb, parseOklch } from '../frontend/src/lib/themeColors.ts';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CSS_FILE = 'frontend/src/index.css';
export const TEXT_MIN = 4.5;
export const NON_TEXT_MIN = 3;

// Surfaces that body or muted text is drawn on, besides each token's own pair.
const SURFACES = ['background', 'card', 'popover', 'muted', 'surface-layer-2', 'surface-layer-3'];

// A token value that is a length or a number, not a colour (`--radius: 0.625rem`).
const NOT_A_COLOUR = /^-?[\d.]+(px|rem|em|%)?$/;

/**
 * The colour tokens of each theme block as { light: Map, dark: Map } of OKLCH values, and `unchecked`: the
 * colour tokens written in a form the check cannot read (hex, hsl), so they are reported, not dropped.
 */
export function parseThemes(css) {
  const unchecked = [];
  const block = (selector, theme) => {
    const match = new RegExp(String.raw`(?:^|\n)${selector}\s*\{([^}]*)\}`).exec(css);
    const tokens = new Map();
    for (const [, name, value] of (match?.[1] ?? '').matchAll(/--([\w-]+):\s*([^;]+);/g)) {
      const color = parseOklch(value);
      if (color) tokens.set(name, color);
      else if (!NOT_A_COLOUR.test(value.trim())) unchecked.push(`${theme} --${name}: ${value.trim()}`);
    }
    return tokens;
  };
  return { light: block(':root', 'light'), dark: block(String.raw`\.dark`, 'dark'), unchecked };
}

/** WCAG relative luminance of an OKLCH colour (converted to linear sRGB, clipped to the gamut). */
export function luminance(color) {
  const [r, g, b] = oklchToLinearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(first, second) {
  const [hi, lo] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The pairs to check in one theme: [foreground, background, minimum, required]. */
export function pairs(tokens) {
  const list = [];
  for (const name of tokens.keys()) {
    const base = name.replace(/-foreground$/, '');
    if (base !== name && tokens.has(base)) list.push([name, base, TEXT_MIN, true]);
  }
  for (const surface of SURFACES.filter((s) => tokens.has(s))) {
    for (const text of ['foreground', 'muted-foreground']) {
      if (tokens.has(text) && !list.some(([f, b]) => f === text && b === surface)) list.push([text, surface, TEXT_MIN, true]);
    }
    if (tokens.has('ring')) list.push(['ring', surface, NON_TEXT_MIN, true]);
    // Chart series are drawn on the chart panel (background) and its card.
    if (surface === 'background' || surface === 'card') {
      for (const name of [...tokens.keys()].filter((t) => /^chart-\d+$/.test(t))) list.push([name, surface, NON_TEXT_MIN, true]);
    }
    if (tokens.has('input') && (surface === 'background' || surface === 'card')) list.push(['input', surface, NON_TEXT_MIN, false]);
  }
  return list;
}

/** Every checked pair of both themes with its ratio and whether it passes. */
export function check(css) {
  const { light, dark } = parseThemes(css);
  return Object.entries({ light, dark }).flatMap(([theme, tokens]) =>
    pairs(tokens).map(([fg, bg, min, required]) => {
      const ratio = contrast(tokens.get(fg), tokens.get(bg));
      return { theme, fg, bg, min, required, ratio, pass: ratio >= min };
    }),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const css = readFileSync(resolve(REPO, CSS_FILE), 'utf8');
  const results = check(css);
  const { unchecked } = parseThemes(css);
  for (const token of unchecked) console.log(`FAIL ${token}: not an oklch() colour, so its contrast cannot be checked`);
  for (const r of results.filter((x) => !x.pass)) {
    console.log(`${r.required ? 'FAIL' : 'WARN'} ${r.theme} --${r.fg} on --${r.bg}: ${r.ratio.toFixed(2)}:1, needs ${String(r.min)}:1`);
  }
  const failed = results.filter((r) => !r.pass && r.required).length + unchecked.length;
  const warned = results.filter((r) => !r.pass && !r.required).length;
  console.log(`contrast-tokens: ${String(results.length)} pairs in ${CSS_FILE}, ${String(failed)} failed, ${String(warned)} advisory.`);
  process.exit(failed > 0 ? 1 : 0);
}
