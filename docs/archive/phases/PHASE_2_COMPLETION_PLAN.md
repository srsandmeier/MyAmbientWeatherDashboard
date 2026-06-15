# Phase 2 Completion Plan

Original Phase 2 foundation work plus the 2026-05-29 closeout review findings.
Complete the remaining closeout items in order; each group removes a blocker found in the
full-code review.

**Status: ✅ COMPLETED — 2026-05-29**

The first pass added the project structure, EF model, migration, JWT plumbing, credential
encryption service, Redis cache registration, rate limiter, Swagger, and analyzer tooling.
The full-code review found that those pieces are not yet wired into a complete, safe Phase 2
foundation. The remaining checklist below is the source of truth for closing Phase 2.

---

## Item 1 — .NET User Secrets + local config baseline

Everything else needs a running app, and the app needs config to start.

### Checklist

- ✅ Run `dotnet tool restore` to activate `dotnet-ef` from `dotnet-tools.json`
- ✅ Run `dotnet user-secrets init --project backend/src/AmbientWeather.Api`
- ✅ Set the four required local secrets:
  ```
  dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=AmbientWeatherDB;Username=postgres;Password=<local-db-password>" --project backend/src/AmbientWeather.Api
  dotnet user-secrets set "ConnectionStrings:Redis" "localhost:6379" --project backend/src/AmbientWeather.Api
  dotnet user-secrets set "Authentication:Authority" "https://YOUR_AUTH0_DOMAIN/" --project backend/src/AmbientWeather.Api
  dotnet user-secrets set "Authentication:Audience" "https://YOUR_AUTH0_AUDIENCE" --project backend/src/AmbientWeather.Api
  ```
  > **Note:** Docker Compose defaults are local-only development values for `Database=AmbientWeatherDB`;
  > set the password from your local environment instead of copying a committed credential. These replaced the
  > `ambientweather`/`postgres` values shown in the original plan draft.
- ✅ Add `backend/src/AmbientWeather.Api/appsettings.Development.json` with non-secret dev defaults
      (log level, Swagger enabled, `AmbientApi:BaseUrl`, `AppName`) — no connection strings or keys in this file
- ✅ Update `README.md` local-setup section with the exact commands above and a note that
      Docker Compose provides Postgres + Redis at those default ports
- ✅ Run `dotnet user-secrets init --project backend/src/AmbientWeather.Workers` and set
      `ConnectionStrings:Postgres` there too (workers process needs DB)
- ✅ **Acceptance**: `dotnet run --project backend/src/AmbientWeather.Api` starts without
      `InvalidOperationException` about missing config (JWT absent in Development is allowed
      by the startup guard added in the review fixes)

---

## Item 2 — EF Core initial migration

Needs Item 1 config so the design-time tooling can resolve the `DbContext`.

### Checklist

- ✅ Add `DesignTimeDbContextFactory` in `AmbientWeather.Infrastructure/Data/`:
  ```csharp
  public class AmbientWeatherDbContextFactory : IDesignTimeDbContextFactory<AmbientWeatherDbContext>
  {
      public AmbientWeatherDbContext CreateDbContext(string[] args)
      {
          var config = new ConfigurationBuilder()
              .AddJsonFile("appsettings.json", optional: true)
              .AddUserSecrets<AmbientWeatherDbContextFactory>(optional: true)
              .AddEnvironmentVariables()
              .Build();
          var connectionString =
              config.GetConnectionString("Postgres")
              ?? "Host=localhost;Port=5432;Database=AmbientWeatherDB;Username=postgres;Password=<local-db-password>";
          var options = new DbContextOptionsBuilder<AmbientWeatherDbContext>()
              .UseNpgsql(connectionString)
              .Options;
          return new AmbientWeatherDbContext(options);
      }
  }
  ```
  > **Note:** Added `Microsoft.Extensions.Configuration.Json`, `.EnvironmentVariables`, and `.UserSecrets`
  > packages to `AmbientWeather.Infrastructure.csproj`, and also ran `dotnet user-secrets init` for
  > Infrastructure so `AddUserSecrets<AmbientWeatherDbContextFactory>` can find the secrets store.
  > Also added `Microsoft.EntityFrameworkCore.Design` (PrivateAssets=all) to `AmbientWeather.Api.csproj`
  > so `dotnet ef` can use the startup project.
- ✅ Run the migration:
  ```
  dotnet ef migrations add InitialCreate \
    --project backend/src/AmbientWeather.Infrastructure \
    --startup-project backend/src/AmbientWeather.Api
  ```
- ✅ Review generated `Migrations/` files and verify:
  - All six tables present: `users`, `user_ambient_credentials`, `user_preferences`,
    `dashboard_layouts`, `weather_stations`, `neighbor_station_cache`, `weather_readings`
  - Column names are snake_case (Npgsql convention maps them automatically)
  - All unique indexes present: `users.auth_provider_sub`,
    `weather_stations.(user_id, mac_address)`, `dashboard_layouts.(user_id, name)`, etc.
  - No unexpected nullable/non-nullable mismatches on required columns
  > **Note:** Required adding `ToTable("weather_readings")` to the `WeatherReading` fluent
  > configuration (extracted into `ConfigureWeatherReadings`) — the entity was missing an explicit
  > table name and was generated as `WeatherReadings` (PascalCase) on the first run.
- ✅ Start Docker Compose and apply the migration:
  ```
  docker compose up -d
  dotnet ef database update \
    --project backend/src/AmbientWeather.Infrastructure \
    --startup-project backend/src/AmbientWeather.Api
  ```
  Verify clean apply with no errors.
- ✅ Add `Testcontainers.PostgreSql` (MIT) to `AmbientWeather.IntegrationTests.csproj`
- ✅ Add `MigrationTests.cs` in the integration test project — spins up a real Postgres
      container via Testcontainers, calls `dbContext.Database.MigrateAsync()`, asserts it
      completes without error
- ✅ Add `backend/src/AmbientWeather.Infrastructure/Migrations/` to `.gitattributes` with
      `text eol=lf` so generated migration files are not corrupted on Windows

---

## Item 3 — MediatR + FluentValidation wiring

No product handlers yet — just the scaffold that all later phases will write into, plus
one real handler that proves the pattern and thins the existing controller.

### Checklist

#### Packages

- ✅ Add to `AmbientWeather.Application.csproj`:
  - `MediatR` (MIT) — latest stable
  - `FluentValidation` (Apache 2.0)
  - `FluentValidation.DependencyInjectionExtensions` (Apache 2.0)
- ✅ Add `MediatR` reference to `AmbientWeather.Api.csproj` (needed to inject `IMediator`
      into controllers)

#### Application layer DI

- ✅ Create `backend/src/AmbientWeather.Application/DependencyInjection.cs` with
      `AddApplication(this IServiceCollection services)`:
  ```csharp
  services.AddMediatR(cfg =>
      cfg.RegisterServicesFromAssembly(typeof(AssemblyReference).Assembly));
  services.AddValidatorsFromAssembly(typeof(AssemblyReference).Assembly);
  services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
  ```
- ✅ Create `Application/Common/Behaviours/ValidationBehavior.cs` — the standard
      FluentValidation pipeline behavior: collects `IValidator<TRequest>` instances, runs
      them all, and throws `ValidationException` (MediatR) if any fail
- ✅ Call `builder.Services.AddApplication()` in `Program.cs`

#### Folder conventions

Create the stub folders (empty `.gitkeep` or marker files) that later phases will fill:

- ✅ `Application/Features/DeviceHistory/Queries/`
- ✅ `Application/Features/Settings/Commands/`
- ✅ `Application/Features/Dashboard/Queries/`

#### First real handler — GetDeviceHistoryQuery

- ✅ Create `Application/Features/DeviceHistory/Queries/GetDeviceHistoryQuery.cs`:
  ```csharp
  public record GetDeviceHistoryQuery(string MacAddress, int Limit, DateTime? EndDate)
      : IRequest<DeviceHistoryResponseDto>;
  ```
- ✅ Create `GetDeviceHistoryQueryValidator.cs` — FluentValidation rules:
  - `MacAddress` passes `MacAddressValidator.IsValid`
  - `Limit` between 1 and 288
  - `EndDate`, when present, is not in the future
- ✅ Create `GetDeviceHistoryQueryHandler.cs` — calls
      `IDeviceHistoryService.GetDeviceHistoryAsync`; the handler does not catch
      `ArgumentException` (validation pipeline prevents invalid input before the handler runs)
- ✅ Thin `DeviceHistoryController.GetHistoryAsync` — remove `ValidateHistoryRequest` and
      `FetchHistoryAsync`; dispatch `new GetDeviceHistoryQuery(...)` via `IMediator`;
      map `ValidationException` → 400 in the catch block
- ✅ Replace `IDeviceHistoryService` constructor injection in the controller with `IMediator`
  > **Note:** `IDeviceHistoryService` is still injected alongside `IMediator` because
  > `InvalidateDeviceCache` still calls `InvalidateCacheAsync` directly. `GetDeviceHistory` uses
  > MediatR; `InvalidateDeviceCache` uses the service + `MacAddressValidator.IsValid` for its
  > own MAC check.

#### Tests

- ✅ Add `AmbientWeather.UnitTests/Features/DeviceHistory/GetDeviceHistoryQueryValidatorTests.cs`:
  - Valid MAC + valid limit passes
  - Short/malformed MAC fails
  - `Limit = 0` fails, `Limit = 289` fails
  - Future `EndDate` fails
- ✅ Add `GetDeviceHistoryQueryHandlerTests.cs`:
  - Success path returns `DeviceHistoryResponseDto` from the service
  - Service returns empty readings → handler returns the DTO (404 is the controller's concern)
  - Service throws `HttpRequestException` → propagates unchanged
  > **Note:** `FluentValidation.TestHelper` is **not** a separate NuGet package since FV v11+.
  > The `TestValidate` extension is bundled in the main `FluentValidation` package — no extra
  > package reference needed in the test project.

---

## Item 4 — Authorization policy + Swagger JWT

The JWT plumbing exists; this wires it to routes and makes it testable from Swagger UI.

### Checklist

#### Policy definition

- ✅ Replace `builder.Services.AddAuthorization()` in `Program.cs` with:
  ```csharp
  builder.Services.AddAuthorization(options =>
  {
      options.AddPolicy("AuthenticatedUser", policy =>
          policy.RequireAuthenticatedUser());
  });
  ```

#### Route protection

- ✅ Add `[Authorize(Policy = "AuthenticatedUser")]` at the `DeviceHistoryController` class
      level (covers both `GetHistory` and `InvalidateCache`)
- ✅ Confirm `[AllowAnonymous]` is on `HealthController.Get` (unauthenticated per the plan)
- ✅ Leave `ApplicationKeyAuthMiddleware` in place for the existing `/api/v1/devices` path
      as a secondary guard — it will be removed in Phase 7 when per-user credential flow is complete

#### Swagger JWT UI

- ✅ Add `SecurityDefinition` and `SecurityRequirement` inside `AddSwaggerGen` so the
      Authorize button appears in the Swagger UI.
  > **API change (Swashbuckle 10.x / Microsoft.OpenApi 2.x):** `OpenApiSecurityScheme.Reference`
  > and `OpenApiReference` were removed. Use the new reference type and factory overload:
  ```csharp
  options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
  {
      Type = SecuritySchemeType.Http,
      Scheme = "bearer",
      BearerFormat = "JWT",
      Description = "Paste your Auth0 access token (without 'Bearer ' prefix)."
  });
  options.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
  {
      { new OpenApiSecuritySchemeReference("Bearer", doc, null), [] }
  });
  ```
- ✅ Add a Swashbuckle `IOperationFilter` (`AuthorizeCheckOperationFilter`) that only applies
      the lock icon to operations on controllers/actions decorated with `[Authorize]`

#### JWT scheme always registered

- ✅ Changed `AddAuthentication()` to always register `JwtBearerDefaults.AuthenticationScheme`,
      configuring authority/audience only when they are present. Without this, `[Authorize]` throws
      `InvalidOperationException: No DefaultChallengeScheme` in Testing/Development environments
      where JWT is not configured.

#### Integration tests

- ✅ Add `GetDeviceHistoryShouldReturn401WhenNoBearerTokenPresent` to
      `DeviceHistoryControllerAuthTests` — confirms the controller now requires JWT, not just
      the app-key middleware
- ✅ Renamed `GetDeviceHistoryShouldReturn400WhenMacAddressIsInvalid` →
      `GetDeviceHistoryShouldReturn401WhenMacAddressIsInvalidAndNoBearerToken` and updated
      expected status to 401. With `[Authorize]` on the controller, authorization rejects before
      MAC validation runs — returning 401 is the correct security behavior.

---

## Item 5 — `Microsoft.AspNetCore.RateLimiting` BFF rate limiter

### Checklist

#### Registration

- ✅ Add `AddRateLimiter` in `Program.cs` with the `per-user` fixed-window policy (60/min,
      partitioned by `sub` → remote IP → `"anonymous"`); `OnRejected` returns 429 `ErrorResponseDto`
- ✅ Add `app.UseRateLimiter()` to the middleware pipeline
  > **Placement change:** placed AFTER `UseAuthentication()` but BEFORE `UseAuthorization()`.
  > `sub` is populated by `UseAuthentication()` (not `UseAuthorization()`), so per-user
  > partitioning still works. Moving it before `UseAuthorization()` also ensures unauthenticated
  > requests are counted, which is required for the integration test to function without a JWT.
- ✅ Apply `[EnableRateLimiting("per-user")]` to `DeviceHistoryController`
- ✅ Leave `HealthController` unannotated (exempt)

#### Integration test

- ✅ Add `RateLimitTests.cs` — send 61 requests in a tight loop via `WebApplicationFactory`,
      assert the 61st returns HTTP 429
- ✅ Added code comment noting that Phase 7 can replace this with a Redis-backed
      `IRateLimiterPolicy` when horizontal scaling requires shared counters across instances

---

## Reopened closeout work — full-code review findings

### Item 6 — Remove browser/query-string Ambient credentials

Ambient `apiKey` and `applicationKey` must never be supplied by the browser after the
settings credential flow exists.

#### Checklist

- ✅ Remove `apiKey` and `applicationKey` query parameters from `DeviceHistoryController.GetDeviceHistory`
- ✅ Remove those fields from `GetDeviceHistoryQuery`, `GetDeviceHistoryQueryValidator`, tests, XML comments, and Swagger output
- ✅ Update the history query path to use `ICurrentUserService.AuthProviderSubject`
- ✅ Load decrypted credentials from `IAmbientCredentialStore` inside the cached history service
- ✅ Return an intentional missing-credentials response when an authenticated user has not saved Ambient keys
- ✅ Confirm no GET endpoint returns `apiKey`, `applicationKey`, or decrypted credential values
- ✅ Add integration tests for missing credentials, valid stored credentials, and keys never appearing in responses

### Item 7 — Finish user ownership and credential settings APIs

The app-owned data model is not complete until protected operations are scoped by the
authenticated user.

#### Checklist

- ✅ Add `POST /api/settings/credentials`
- ✅ Validate credential payloads with FluentValidation
- ✅ Validate submitted credentials with an Ambient `/v1/devices` test call through `RateLimitedApiClient`
- ✅ Encrypt and upsert credentials with `IAmbientCredentialStore`
- ✅ Add `DELETE /api/settings/credentials`
- ✅ Add a safe credential status/read endpoint if the UI needs one, returning only booleans/timestamps
- ✅ Add settings/preference handlers after the credential boundary is tested — `GET/PUT /api/settings/preferences` implemented with `IUserPreferencesStore`, `GetUserPreferencesQuery`, `UpdateUserPreferencesCommand/Validator/Handler`, and integration tests.
- ✅ Add valid JWT/current-user integration tests, including user A cannot read or modify user B data. Covered by `SettingsCredentialsApiTests` using `TestAuthHandler`.
- ✅ Replace the Development `RequireAssertion(_ => true)` bypass with an explicit dev/test auth scheme that exercises current-user behavior — `TestAuthHandler` registered in `Testing` environment via `TestApplicationFactory`; Development bypass retained for Swagger-only local use until Phase 3 frontend login is wired.
- ✅ `ApplicationKeyAuthMiddleware` stays on `/api/v1/devices` with explicit comment; will be removed in Phase 7 when BFF migration is complete

### Item 8 — Fix history service and worker runtime failures

Two production paths still call an intentionally unsupported credential-less Ambient REST
method.

#### Checklist

- ✅ Fix `DeviceHistoryService.GetDeviceHistoryAsync` cache misses so they use stored/server-side credentials or remove that service path from production use
- ✅ Fix `HistorySyncWorker.SyncConfiguredDeviceAsync` so it no longer calls the unsupported credential-less overload
- ✅ Remove the credential-less `IAmbientRestClient.GetDeviceHistoryAsync` overload, or make it impossible for production code to call accidentally
- ✅ Add tests proving cache miss fetches and worker sync do not throw `NotSupportedException`
- ✅ `HistorySyncWorker` and `weather_readings` ownership invariants deferred to Phase 6/8 (optional local sync)

### Item 9 — Correct EF/PostgreSQL model and migrations

The current migration applies, but several planned invariants are not enforced.

#### Checklist

- ✅ Fix `AmbientWeatherDbContextFactory` to load the same local secrets/configuration as the API startup project
- ✅ Remove the mismatched hardcoded design-time connection string fallback
- ✅ Credential columns stay as `text` (Data Protection base64 strings). `SECURITY.md` updated.
- ✅ Filtered unique index for one active dashboard layout per user (`AddSchemaInvariants`)
- ✅ Filtered unique index for one primary station per user (`AddSchemaInvariants`)
- ✅ FK from `UserPreferences.DefaultWeatherStationId` to `WeatherStation` with `OnDelete(SetNull)` (`AddSchemaInvariants`)
- ✅ `weather_readings` ownership invariants deferred — see Item 8 above
- ✅ `.AsNoTracking()` on read-only EF queries
- ✅ `SchemaInvariantTests` assert filtered unique indexes and FK constraint enforcement

### Item 10 — Stabilize Data Protection, rate limiting, and Swagger

The infrastructure is present but needs production-safe wiring and cleanup.

#### Checklist

- ✅ Configure Data Protection with a stable application name
- ✅ Persist/share the Data Protection key ring for API and Worker processes
- ✅ Move outbound Ambient retry attempts through rate limiting so retries respect Ambient budgets
- ✅ `AmbientCircuitOpenException` maps to 503 `ambient-unavailable` in `GlobalExceptionHandlerMiddleware`
- ✅ Remove duplicate Swagger Bearer requirements by keeping either global security requirement or per-operation filter
- ✅ Fix the stale `RateLimitTests` comment that says the rate limiter runs after `UseAuthorization`
- ✅ Remove the unused `appKeyRequest` allocation in `RateLimitTests`

### Item 11 — Documentation and verification closeout

#### Checklist

- ✅ `DEVELOPMENT_PLAN.md` Phase 2 status marked complete; snapshot table and gaps updated
- ✅ `SECURITY.md` updated to reflect `text` columns and actual `CredentialEncryptionService` implementation
- ✅ `README.md` final local-setup section — completed in later phase documentation closeout.
- ✅ Agent/rule docs — completed in later phase documentation closeout.
- ✅ `dotnet format --verify-no-changes` passes
- ✅ `dotnet test` passes (89 unit + 38 integration)
- ✅ `npm run lint`, `npm test`, `npm run build` — completed by later full-stack CI/verification gates.
- ✅ `git diff --check` passes

---

## Phase 2 final acceptance checklist

- ✅ `dotnet ef database update` applies cleanly — `InitialCreate` + `AddSchemaInvariants` both applied
- ✅ `dotnet build` produces 0 errors and 0 warnings
- ✅ `dotnet test` passes all unit + integration tests — 89 unit + 38 integration (includes Testcontainers migration + schema invariants)
- ✅ `dotnet run` — `/swagger` shows the Authorize button once; protected routes use JWT + stored credentials
- ✅ `npm test`, `npm run lint`, `npm run build` pass (frontend is still a placeholder — no changes)
- ✅ `git diff --check` passes
- ✅ Development plan updated: Phase 2 header changed to ✅ COMPLETED; all closeout items ticked
