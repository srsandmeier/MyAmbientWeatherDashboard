# Agent: Data (EF Core + PostgreSQL)

Handles `backend/src/AmbientWeather.Infrastructure/Data/`, repositories, migrations, and domain entities in
`AmbientWeather.Domain/`.

---

## Stack

| Package | Licence | Purpose |
|---|---|---|
| EF Core 10 | MIT | ORM |
| Npgsql.EntityFrameworkCore.PostgreSQL | PostgreSQL | Provider |
| EF Core migrations | MIT | Schema versioning |

SQLite and desktop storage are **not** used in this webapp.

---

## Entities (Domain)

| Entity | Table | Notes |
|---|---|---|
| `User` | `users` | Maps Auth0 `sub` |
| `UserAmbientCredentials` | `user_ambient_credentials` | Encrypted key blobs |
| `UserPreferences` | `user_preferences` | Units, theme, neighbour JSON |
| `DashboardLayout` | `dashboard_layouts` | react-grid-layout JSON |
| `WeatherStation` | `weather_stations` | Primary + cached neighbours |
| `WeatherReading` | `weather_readings` | 5-min time series |
| `ReadingAggregate` | `reading_aggregates` | Hourly/daily rollups |
| `HistorySyncCursor` | `history_sync_cursors` | Backfill watermark |
| `NeighbourStationCache` | `neighbour_station_cache` | Ranked neighbours per user |

Full column spec: `docs/DEVELOPMENT_PLAN.md` (Data Model section).

---

## DbContext pattern

```csharp
public sealed class AppDbContext : DbContext
{
    public DbSet<WeatherReading> WeatherReadings => Set<WeatherReading>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<WeatherReading>(e =>
        {
            e.HasIndex(r => new { r.StationId, r.RecordedAtUtc }).IsUnique();
            e.Property(r => r.RawJson).HasColumnType("jsonb");
        });
        // ... other configurations
    }
}
```

Use explicit fluent configuration. Avoid data annotations on domain entities where possible.

---

## Query rules

- **Read-only queries:** always `.AsNoTracking()`.
- **Prevent N+1:** use `.Include()` or project to DTOs with `.Select()`.
- **Pagination:** history queries use keyset pagination on `recorded_at_utc`.
- **Upserts:** sync worker uses `ON CONFLICT (station_id, recorded_at_utc) DO UPDATE` via EF or raw SQL.
- **No tracking in handlers** that only return DTOs.

```csharp
public async Task<IReadOnlyList<WeatherReadingDto>> GetHistoryAsync(
    Guid stationId, DateTime from, DateTime to, CancellationToken ct)
{
    return await _db.WeatherReadings
        .AsNoTracking()
        .Where(r => r.StationId == stationId
                 && r.RecordedAtUtc >= from
                 && r.RecordedAtUtc <= to)
        .OrderBy(r => r.RecordedAtUtc)
        .Select(r => new WeatherReadingDto(r.RecordedAtUtc, r.OutdoorTempF, /* ... */))
        .ToListAsync(ct);
}
```

---

## Migrations

- One migration per logical schema change; descriptive name: `AddWeatherReadingsIndex`.
- Never edit applied migrations — add a new migration to fix forward.
- Seed data only in dev via `HasData` or a dedicated dev seeder — not in production migrations.

---

## Sync and rollups

| Operation | Owner | Storage |
|---|---|---|
| Ingest 5-min readings | Optional future `HistorySyncWorker` | `weather_readings` |
| Backfill cursor | Optional future `HistorySyncWorker` | `history_sync_cursors` |
| Hourly/daily aggregates | Optional future `RollupWorker` | `reading_aggregates` |

Local time-series sync is optional until Ambient API plus Redis caching proves insufficient. If enabled,
rollup jobs aggregate from `weather_readings` — do not re-fetch Ambient for rollups.

Rainfall charts: sum `hourlyrainin` into buckets. Snapshot fields (`dailyrainin`, etc.) are for tiles only.

---

## Repository interfaces (Application layer)

Define interfaces in `AmbientWeather.Application/Common/Interfaces/`:

```csharp
public interface IWeatherReadingRepository
{
    Task UpsertBatchAsync(IReadOnlyList<WeatherReading> readings, CancellationToken ct);
    Task<IReadOnlyList<WeatherReadingDto>> GetRangeAsync(/* ... */, CancellationToken ct);
}
```

Implement in Infrastructure. Handlers depend on interfaces — not `AppDbContext` directly.

---

## Testing (required)

| Target | Tool |
|---|---|
| Repository queries | xUnit + Testcontainers PostgreSQL or in-memory if feasible |
| Migrations | Apply against empty DB in CI |
| Upsert idempotency | Integration test: same batch twice → no duplicates |
| Rollup math | Unit test with seeded readings |

---

## Must NOT do

- Use SQLite for production or test parity (PostgreSQL features: `jsonb`, timestamptz).
- Return EF entities from handlers — map to DTOs.
- Load entire history tables into memory — always filter by date range.
- Store Ambient keys in plain text columns.

---

## Privacy — faker for all location data

Never hardcode any address, GPS coordinate, station ID, zip code, or place name in code or tests — not even as an "example."
- C# tests: `Bogus`. TypeScript tests: `@faker-js/faker`. Both libraries produce real US state abbreviations by default.
- When a test requires a geographically accurate address, pick a real US airport at random from a short predefined list.
- Every test run must produce different location values. Never save any address, GPS coordinate, or station ID that a user enters.
