import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NON_TEXT_MIN, TEXT_MIN, check, contrast, luminance, pairs, parseThemes } from './contrast-tokens.mjs';

const WHITE = { l: 1, c: 0, h: 0 };
const BLACK = { l: 0, c: 0, h: 0 };

const css = [
  ':root {',
  '  --background: oklch(1 0 0);',
  '  --foreground: oklch(0 0 0);',
  '  --primary: oklch(0.2 0 0);',
  '  --primary-foreground: oklch(0.985 0 0);',
  '  --radius: 0.625rem;',
  '}',
  '.dark {',
  '  --background: oklch(0.145 0 0);',
  '  --foreground: oklch(0.3 0 0);',
  '  --ring: oklch(0.2 0 0);',
  '}',
].join('\n');

test('white and black are luminance 1 and 0, and 21:1 apart', () => {
  assert.equal(Math.round(luminance(WHITE) * 1000) / 1000, 1);
  assert.equal(luminance(BLACK), 0);
  assert.equal(Math.round(contrast(WHITE, BLACK)), 21);
  assert.equal(contrast(BLACK, WHITE), contrast(WHITE, BLACK));
});

test('a saturated colour is clipped to the sRGB gamut, not pushed past luminance 1', () => {
  assert.ok(luminance({ l: 0.99, c: 0.4, h: 140 }) <= 1);
});

test('each theme block is parsed on its own, and non-colour tokens are ignored', () => {
  const { light, dark } = parseThemes(css);
  assert.deepEqual([...light.keys()], ['background', 'foreground', 'primary', 'primary-foreground']);
  assert.deepEqual([...dark.keys()], ['background', 'foreground', 'ring']);
  assert.deepEqual(dark.get('foreground'), { l: 0.3, c: 0, h: 0 });
});

test('every -foreground is paired with its base, and text and ring with each surface', () => {
  const { light, dark } = parseThemes(css);
  assert.deepEqual(pairs(light), [
    ['primary-foreground', 'primary', TEXT_MIN, true],
    ['foreground', 'background', TEXT_MIN, true],
  ]);
  assert.deepEqual(pairs(dark), [
    ['foreground', 'background', TEXT_MIN, true],
    ['ring', 'background', NON_TEXT_MIN, true],
  ]);
});

test('low-contrast dark text and ring fail; the light pairs pass', () => {
  const failed = check(css).filter((r) => !r.pass).map((r) => `${r.theme} ${r.fg}/${r.bg}`);
  assert.deepEqual(failed, ['dark foreground/background', 'dark ring/background']);
});
