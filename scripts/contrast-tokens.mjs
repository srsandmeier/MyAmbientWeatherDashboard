// WCAG contrast of the theme tokens in frontend/src/index.css, light (:root) and dark (.dark), with no
// browser (.claude/skills/contrast-tokens/SKILL.md). Every `--x-foreground` is checked on its `--x`, and
// body and muted text on every surface it is drawn on. Text needs 4.5:1 (WCAG 1.4.3); the focus ring and
// the `--chart-N` series need 3:1 (1.4.11). The OKLCH conversion matches frontend/src/lib/themeColors.ts,
// which the browser bundle uses; Node scripts cannot import that TypeScript file. Input borders at 3:1 are advisory: a field can be identified by other cues.
//
//   node scripts/contrast-tokens.mjs    # one line per failing pair, then the totals; exits 1 on a failure

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CSS_FILE = 'frontend/src/index.css';
export const TEXT_MIN = 4.5;
export const NON_TEXT_MIN = 3;

// Surfaces that body or muted text is drawn on, besides each token's own pair.
const SURFACES = ['background', 'card', 'popover', 'muted', 'surface-layer-2', 'surface-layer-3'];

/** The `--name: oklch(L C h)` tokens of each theme block, as { light: Map, dark: Map }. */
export function parseThemes(css) {
  const block = (selector) => {
    const match = new RegExp(String.raw`(?:^|\n)${selector}\s*\{([^}]*)\}`).exec(css);
    const tokens = new Map();
    for (const [, name, l, c, h] of (match?.[1] ?? '').matchAll(/--([\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g)) {
      tokens.set(name, { l: Number(l), c: Number(c), h: Number(h) });
    }
    return tokens;
  };
  return { light: block(':root'), dark: block(String.raw`\.dark`) };
}

/** WCAG relative luminance of an OKLCH colour (converted to linear sRGB, clipped to the gamut). */
export function luminance({ l, c, h }) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (v) => Math.min(1, Math.max(0, v));
  const r = clip(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc);
  const g = clip(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc);
  const bl = clip(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
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
  const themes = parseThemes(css);
  return Object.entries(themes).flatMap(([theme, tokens]) =>
    pairs(tokens).map(([fg, bg, min, required]) => {
      const ratio = contrast(tokens.get(fg), tokens.get(bg));
      return { theme, fg, bg, min, required, ratio, pass: ratio >= min };
    }),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const results = check(readFileSync(resolve(REPO, CSS_FILE), 'utf8'));
  for (const r of results.filter((x) => !x.pass)) {
    console.log(`${r.required ? 'FAIL' : 'WARN'} ${r.theme} --${r.fg} on --${r.bg}: ${r.ratio.toFixed(2)}:1, needs ${String(r.min)}:1`);
  }
  const failed = results.filter((r) => !r.pass && r.required).length;
  const warned = results.filter((r) => !r.pass && !r.required).length;
  console.log(`contrast-tokens: ${String(results.length)} pairs in ${CSS_FILE}, ${String(failed)} failed, ${String(warned)} advisory.`);
  process.exit(failed > 0 ? 1 : 0);
}
