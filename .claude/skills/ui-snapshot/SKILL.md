---
name: ui-snapshot
description: Take full-page screenshots of the dashboard, metric detail and settings pages at phone, tablet and desktop widths in light and dark themes, against the mocked app (no backend needed). Use to see what a UI change looks like, check dark mode and phone layout, or give a design review something to judge.
---

# ui-snapshot

```bash
npm run ui:snapshot                     # every page: 3 pages x 2 themes x 3 widths = 18 PNGs
npm run ui:snapshot -- --grep settings  # one page
```

- Runs `tests/e2e/snapshot/ui-snapshot.spec.ts` with `tests/e2e/snapshot.config.ts`: the E2E fixtures
  mock Auth0 and every BFF call, and Vite starts on 5173 if nothing is running there. It never runs in CI.
- Writes `tests/e2e/test-results/ui-snapshot/<page>-<light|dark>-<phone|tablet|desktop>.png` (ignored by git).
- The theme follows the emulated colour scheme because the mocked preferences say "system"; the run fails
  if the `dark` class does not match.

**Reading them costs tokens:** open only the images the change affects, phone width first (it breaks
first), then the same page in the other theme. To compare before and after, run it on `main` and copy the
folder to your scratchpad first.

Look for: text or controls overlapping or cut off, horizontal scroll, low-contrast text or borders in
either theme, icon-only buttons with no visible focus, empty and error states that look broken.
After fixing what you find, `npm run self-review`.
