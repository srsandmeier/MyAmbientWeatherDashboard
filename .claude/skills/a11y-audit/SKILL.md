---
name: a11y-audit
description: Run the WCAG 2.2 AA checks this repo has against the rendered app — the axe page audits and keyboard walkthrough specs in Playwright, jest-axe in component tests, a token contrast check, and a manual keyboard and reflow pass for what automation cannot see. Use after any UI change, before a PR that touches the UI, or when asked whether something is accessible.
---

# a11y-audit

## Automated

```bash
npm run test:e2e -- specs/axe-audits.spec.ts specs/accessibility-quality.spec.ts > "$TMP/a11y.log" 2>&1
npm run ui:contrast        # theme token contrast, light and dark (contrast-tokens skill)
```

- `axe-audits.spec.ts` scans dashboard, metric detail and settings with `expectNoAxeViolations`
  (`tests/e2e/fixtures/axe.ts`); a new page or dialog gets a test there.
- `accessibility-quality.spec.ts` walks the keyboard paths and error recovery.
- Component tests use jest-axe; a new component with interactive parts gets an axe assertion.

## Manual pass (what axe cannot judge)

Probe the running app (a short Playwright script, or `npm run ui:snapshot` for the visuals):

- **Keyboard:** Tab reaches every control in a sensible order with a visible focus ring; Escape closes
  menus and dialogs and focus returns to the opener; the layout editor works without a mouse.
- **Reflow:** at 320 CSS px wide nothing scrolls sideways or overlaps; at 200% zoom text is not cut off.
- **Targets:** interactive targets are at least 24 by 24 px.
- **Names and live regions:** icon-only buttons have accessible names; live updates use polite status
  regions and never move focus; charts keep their description and data table.
- **Both themes:** text, borders and focus rings are visible in light and dark.

Report in the format of `docs/AGENT_GUIDELINES.md`, citing the WCAG criterion. Then `npm run self-review`.
