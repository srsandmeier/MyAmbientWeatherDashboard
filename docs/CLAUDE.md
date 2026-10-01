# Documentation rules

Loaded when Claude works on files under `docs/`. Repo-wide rules (privacy, shell safety, context
limits, commit format) are in the root `CLAUDE.md`.

---

## Rules

### Phase planning and closeout steps
When planning or completing any phase, keep the documentation chain in sync:
- Update `README.md` for newly implemented features, commands, setup steps, endpoints, or tooling.
- Update `docs/DEVELOPMENT_PLAN.md` with final status, verification, and deferrals.
- Update the immediately previous phase plan/closeout when carry-in work is completed, moved, or reclassified.
- Update the current phase plan before closeout so its checklist, verification, and deferred-work ledger match the code.
- When adding provider-specific plan items or integrations, include the official provider documentation link
  in the relevant phase plan and related-docs table. For Open-Meteo source fields, reference
  `https://open-meteo.com/en/docs`.
- Include a final **Check EF migrations** step in every phase closeout going forward:
  `dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api`.

### Sanitize plans as they are written
Use placeholders or clearly dummy local-only values for tenant domains, client IDs, passwords, tokens,
addresses, station IDs, personal paths, and deployment-specific identifiers. Do not add real or reusable
local values to plans with the intent to clean them later.
