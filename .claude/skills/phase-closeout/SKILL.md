---
name: phase-closeout
description: Close out a development phase — sync the documentation chain, recheck the agents and skills the phase touched, confirm no EF migration is pending, and run the full pre-PR gate. Use when the user types /phase-closeout or asks to close or finish a phase.
disable-model-invocation: true
---

# phase-closeout

The documentation rules are in `docs/CLAUDE.md`, "Phase planning and closeout steps"; this is the order to
do them in.

1. **Current phase plan:** checklist, verification and the deferred-work ledger match the code.
2. **Previous phase plan:** carry-in work that was completed, moved or reclassified is updated there.
3. **`docs/DEVELOPMENT_PLAN.md`:** final status, verification and deferrals (outline it with
   `grep -n "^## "` and edit only that phase).
4. **`README.md`:** new features, commands, setup steps, endpoints or tooling.
5. **Agents, skills and folder `CLAUDE.md` files** the phase touched: stack facts, commands and file names
   still hold. `npm run lint` runs `scripts/check-agents-skills.mjs`, which fails on a script, path or
   class that no longer exists. Changed which `CLAUDE.md` files exist? Run
   `node scripts/check-instructions-loading.mjs --all`.
6. **Plans are sanitized:** no real tenant domains, client IDs, tokens, addresses, station IDs or
   personal paths.
7. **Check EF migrations:**
   `dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api`
   shows nothing pending (`ef-migration` if something is).
8. **Gate:** `npm run self-review`, answer the checklist, then `npm run pre-pr` and read
   `test-results/summary.txt`.
