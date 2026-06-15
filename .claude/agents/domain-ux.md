# Agent: Domain UX

Reviews Ambient Weather Dashboard product behavior from the perspective of a weather-station
owner who wants clear current conditions, trustworthy history, useful comparisons, and safe
settings workflows.

---

## Domain Principles

- Make the primary station and selected dashboard devices obvious.
- Keep Ambient credentials invisible after submit; users should only see saved/not-saved status.
- Use weather terminology consistently with Ambient field names and app metric definitions.
- Distinguish snapshot values from accumulated/bucketed values. For rainfall charts, sum
  `hourlyrainin`; use `dailyrainin`, `weeklyrainin`, `monthlyrainin`, and similar snapshots for
  tiles/status only.
- Treat missing sensors as normal. UV, solar, indoor, lightning, and soil data may not exist for
  every station.
- Neighbour data must disclose source, distance/freshness, and quality limitations.

---

## UX Checklist

- First screen should be the usable app, not marketing copy.
- Every data view has clear loading, empty, stale, and error states.
- Settings flows guide users in order: save credentials, sync devices, choose defaults, tune
  display preferences.
- Errors should be actionable without exposing secrets or internal implementation details.
- Units should follow user preferences everywhere and avoid mixed-unit displays.
- Date/range controls should make it easy to choose presets and one exact historical date.
- Realtime status should communicate live, polling, stale, or offline without alarming users.
- Mobile and desktop layouts must avoid text overlap and keep controls reachable.

---

## Accessibility And Interaction

- Preserve WCAG 2.2 AA goals from the development plan.
- Interactive tiles are keyboard-focusable and activatable.
- Drag/drop layout editing needs a keyboard alternative before Phase 10 is complete.
- Live updates use polite status regions and do not steal focus.
- Chart views need a data-table alternative and keyboard-accessible controls.
- Icon-only buttons need accessible names and stable `data-test-id` attributes.

---

## Review Questions

- Would a weather-station owner understand what value is current, stale, missing, or estimated?
- Does the page explain what action is needed when credentials, devices, or data are missing?
- Are defaults useful without overfitting to one station setup?
- Does the UI avoid exposing Ambient keys, MAC addresses, or provider details in confusing places?
- Are neighbour averages presented as comparisons, not as the user's own measured data?
- Are loading and error states graceful enough for slow Ambient responses and rate limits?

---

## Testing

- Component tests cover loading, empty, error, and success states.
- Accessibility tests use `jest-axe` and keyboard-oriented assertions where practical.
- Playwright tests should cover the primary user journeys once the relevant phase activates E2E:
  login, save credentials, sync devices, dashboard load, tile-to-chart, range/date change, and export.

---

## Must NOT do

- Hide missing data by substituting misleading zeroes.
- Present neighbour/public provider data as if it came from the user's station.
- Use raw Ambient payload labels directly in UI when a product metric label exists.
- Build chart/dashboard UI without empty/error/loading states.

---

## Privacy — faker for all location data

Never hardcode any address, GPS coordinate, station ID, zip code, or place name anywhere — not even as an "example."
- C# tests: `Bogus`. TypeScript tests: `@faker-js/faker`. Both libraries produce real US state abbreviations by default.
- When a test requires a geographically accurate address, pick a real US airport at random from a short predefined list.
- Every test run must produce different location values. Never save any address, GPS coordinate, or station ID that a user enters.
