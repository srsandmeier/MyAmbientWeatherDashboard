---
name: contrast-tokens
description: Compute WCAG contrast for the theme tokens in frontend/src/index.css in light and dark, with no browser — each foreground on its surface, body and muted text on every surface, and the focus ring. Use before or after changing a colour token or a text/background pairing, when choosing colours for a new component, or to explain an axe contrast failure.
---

# contrast-tokens

```bash
npm run ui:contrast    # node scripts/contrast-tokens.mjs: one line per failing pair, then totals
```

- Reads the OKLCH tokens in `:root` (light) and `.dark`, converts them to sRGB luminance and checks:
  every `--x-foreground` on `--x`; `--foreground` and `--muted-foreground` on each surface (background,
  card, popover, muted, surface layers); `--ring` on each surface; each `--chart-N` on background and card.
- Text needs 4.5:1 (WCAG 1.4.3); the focus ring and chart series 3:1 (1.4.11): all are `FAIL` and exit 1,
  which fails `npm run lint` and CI. Input borders below 3:1 are `WARN`: a field can be identified by its
  label and fill. A colour token that is not `oklch()` (hex, hsl) also fails, so no token drops out of the
  check; `oklch()` with a percentage, `deg` or an alpha is read.
- The parsing and the OKLCH conversion are `frontend/src/lib/themeColors.ts`, the code the charts draw with.
- It checks tokens, not components: a component that uses a raw colour utility (`text-green-800`) needs
  its `dark:` partner checked by eye or with `ui-snapshot`.

**Fixing a failure:** change the token's lightness in `frontend/src/index.css` for the failing theme only,
rerun until it passes, then look at the affected pages with `ui-snapshot`, since a token change reaches
every component that uses it. Then `npm run self-review`.
