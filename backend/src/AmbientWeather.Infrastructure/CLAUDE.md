# Infrastructure rules (data and persistence)

Loaded when Claude works on files under `AmbientWeather.Infrastructure/`. Backend architecture, the EF
migration rule and test rules are in `backend/CLAUDE.md`; Ambient clients in `Ambient/CLAUDE.md`; nearby
providers in `Neighbors/CLAUDE.md`.

---

## Data

### Schema and DbContext
- `AmbientWeatherDbContext` (`Data/`) configures every entity with explicit fluent configuration in
  `OnModelCreating` (snake_case columns, `jsonb` for JSON such as `neighbor_config_json`); no data
  annotations on domain entities. Entities live in `AmbientWeather.Domain/Entities/`.
- Schema invariants are enforced by the database, not only by code: one active layout and one primary
  station per user, unique `(UserId, MacAddress)` stations, and the preferences → default station foreign
  key. `SchemaInvariantTests` covers them; a new invariant gets a constraint and a test there.
- PostgreSQL only (`jsonb`, `timestamptz`, partial unique indexes): never SQLite, not even in tests.

### Queries
- Read-only queries use `.AsNoTracking()` and project to DTOs with `.Select()` where the caller needs a
  DTO; handlers never receive EF entities to return.
- Time-series reads (`weather_readings`) are always filtered by device and a date range and use the
  `(DeviceMacAddress, DateUtc)` index; nothing loads a whole history table.
- Handlers depend on the interfaces in `AmbientWeather.Application/Interfaces/` (`IWeatherReadingRepository`,
  `IUserStationStore`, `IUserPreferencesStore`, …), implemented in `Repositories/` and `Services/`; never on
  `AmbientWeatherDbContext`.

### Migrations
- Scaffold with `npm run db:migrate -- AddDescriptiveName` (the `ef-migration` skill has the steps). One
  migration per logical change; never edit one that has been applied; fix forward.
- Seed data only for development, never in a production migration.

### Data: must not
- Store Ambient keys in a plain-text column (`CredentialEncryptionService`; `docs/SECURITY.md`).
- Return EF entities from a handler or across the Application boundary.
- Re-fetch Ambient to compute something that `weather_readings` or the cache already holds.
