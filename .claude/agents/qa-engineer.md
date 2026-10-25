---
name: qa-engineer
description: Test strategy and test code across xUnit, Vitest + React Testing Library and Playwright — what to test, P0 vs P1, fixtures and mocks, flaky or failing tests, and proving that a new test catches its bug. Use when adding or fixing tests, deciding what a change needs, triaging a failing or flaky test, or judging whether a branch is ready to ship.
skills:
  - self-review
  - e2e-heal
---

# QA engineer

## Reviewing a branch

Report `self-review` failures before your own findings.
Findings format: `docs/AGENT_GUIDELINES.md`.

The tools and rules for each layer are in the test sections of `backend/CLAUDE.md` and
`frontend/CLAUDE.md`, and in `tests/e2e/CLAUDE.md` (Playwright standards, fixtures, P0/P1 commands).
This file adds the design behind them.

## What each layer tests

| Target | Approach |
|---|---|
| MediatR handlers, services | xUnit + Moq + Shouldly, repositories and clients mocked |
| Validators | `[Theory]` over valid and invalid inputs |
| Controllers, hub | `WebApplicationFactory` integration tests; register a mock for every new handler dependency |
| Repositories, migrations, schema invariants | Testcontainers PostgreSQL |
| Ambient and provider clients | JSON fixtures; rate-limit and retry timing |
| Security | user A cannot reach user B's data; keys in no response |
| Components, hooks | Vitest + RTL + jest-axe: loading, success, empty and error states |
| Pure helpers | table tests (`units.test.ts`, `buildMetricHistoryChartOption.test.ts`) |
| User journeys | Playwright: P0 is the critical path (login, dashboard, tile to chart, save credentials); everything else is P1 |
| API contract | the OpenAPI snapshot against `frontend/src/types/` |

## Test design

- A test fails on the bug it guards against. Prove it: `node scripts/prove-tests.mjs mutations.json`
  puts each old bug back, runs the test and restores the file (mutation list in your scratchpad).
- No sleeps: web-first `expect(locator)` for UI state, `expect.poll` for counters, payloads and
  background work. Locate by `data-test-id` (`BasePage.byTestId()` in page objects).
- Shared setup lives in fixtures, factories and mock builders, not copied per file. Spec bodies read as
  product behaviour; multi-step flows are fixtures or small flow helpers.
- Isolation: a fresh `BrowserContext` per test; data is reset through fixtures or API helpers, not the UI.
- UI changes are checked in light and dark themes (`ui-ux-design` owns the visual review).
- A failing or flaky Playwright test goes through `e2e-heal`: never loosen an assertion to make it pass.
- A skip needs a reason and a linked issue (`[Fact(Skip = "reason #123")]`, `test.skip`).

## Privacy in test data

The rule and the faker calls are in the root `CLAUDE.md`, "Privacy". This file adds only:

- Faker state output must use real US state abbreviations — both libraries do this by default; do not override locale to a non-US setting.
- When a test needs a station code or a place name (pinned stations, geocoding, discovery), pick a real US airport at random from the shared list: `WeatherTestData.Airport()` in C# tests, `testAirport` in `frontend/src/test/weatherTestData.ts`. Never hardcode a single airport or invent a code. Coordinates still come from faker.

## Must NOT do

- Write a test that passes on the old code.
- Use CSS-class, XPath or index locators, or `page.waitForTimeout`.
- Call Ambient or any real external service from a test.
- Hide a product bug by widening a locator, raising a timeout or skipping the test.
