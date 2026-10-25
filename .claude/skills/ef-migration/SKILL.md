---
name: ef-migration
description: Add, review, apply and verify an EF Core migration for a schema change — entity and fluent configuration, scaffold, review of Up/Down and the snapshot, apply locally, migration and schema-invariant tests, pending-migration check. Use whenever an entity, column, index, constraint or relationship changes, and at phase closeout to confirm nothing is pending.
---

# ef-migration

Rules: `backend/CLAUDE.md` ("Schema changes require EF migrations") and
`backend/src/AmbientWeather.Infrastructure/CLAUDE.md` (schema and migration rules). Needs Docker running.

1. **Change the model:** the entity in `AmbientWeather.Domain/Entities/` and its fluent configuration in
   `AmbientWeatherDbContext.OnModelCreating` (snake_case column, `jsonb` for JSON, a unique or partial index
   for an invariant).
2. **Scaffold:** `npm run db:migrate -- AddDescriptiveName > "$TMP/ef.log" 2>&1` and read only the tail of
   the log.
3. **Review the generated files** in `Infrastructure/Migrations/`: `Up` does only the intended change,
   `Down` reverses it, nothing unrelated appears (an unexpected change means the snapshot was behind), and
   no data is lost on a rename (EF scaffolds drop and add; rewrite it as a rename).
4. **Apply locally:** `npm run db:update > "$TMP/ef.log" 2>&1`.
5. **Test:** `dotnet test backend/AmbientWeather.slnx -c Release --filter "FullyQualifiedName~MigrationTests|FullyQualifiedName~SchemaInvariantTests"`.
   A new invariant gets a test in `SchemaInvariantTests`.
6. **Check nothing is pending:** `dotnet ef migrations list --project backend/src/AmbientWeather.Infrastructure --startup-project backend/src/AmbientWeather.Api`
   (after `dotnet tool restore`; it marks pending migrations only when the database is up).
7. **Commit together:** the entity change, the migration, its designer file and the model snapshot.
8. Finish with `npm run self-review` before review.

Never edit a migration that has been applied anywhere; add a new one that fixes forward.
