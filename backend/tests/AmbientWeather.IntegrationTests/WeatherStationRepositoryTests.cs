#pragma warning disable MA0004 // ConfigureAwait(false) intentionally omitted in [Fact] bodies per xUnit1030
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.Data;
using AmbientWeather.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Testcontainers.PostgreSql;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Shared Postgres container for <see cref="WeatherStationRepositoryTests"/>.
/// One container is started for all tests in the class.
/// </summary>
public sealed class WeatherStationRepositoryFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    /// <summary>Gets the Postgres connection string for test contexts.</summary>
    public string ConnectionString => _postgres.GetConnectionString();

    /// <inheritdoc />
    public async Task InitializeAsync()
    {
        await _postgres.StartAsync().ConfigureAwait(false);
        var options = new DbContextOptionsBuilder<AmbientWeatherDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;
        await using var ctx = new AmbientWeatherDbContext(options);
        await ctx.Database.MigrateAsync().ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task DisposeAsync() => await _postgres.DisposeAsync().ConfigureAwait(false);
}

/// <summary>
/// Repository-level integration tests for <see cref="WeatherStationRepository"/>.
/// Verifies Phase 7/8 carry-in invariants: station sync, primary/default repair, and
/// cross-user isolation. Each test creates its own unique user for full isolation.
/// </summary>
public sealed class WeatherStationRepositoryTests(WeatherStationRepositoryFixture fixture)
    : IClassFixture<WeatherStationRepositoryFixture>
{
    // -----------------------------------------------------------------------
    // SyncStationsAsync — first sync
    // -----------------------------------------------------------------------

    [Fact]
    public async Task FirstSyncShouldCreateUserStationsAndSeedDefaultPreferences()
    {
        var subject = UniqueSubject();

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);

        var stations = await repo.SyncStationsAsync(subject, "user@test.local",
            [Device("AA:BB:CC:DD:01:01", "Garden")]);

        stations.Count.ShouldBe(1);
        stations[0].IsPrimary.ShouldBeTrue();
        stations[0].MacAddress.ShouldBe("AABBCCDD0101");

        var prefs = await GetPrefsAsync(subject);
        prefs.ShouldNotBeNull("UserPreferences row must be seeded on first sync");
        prefs!.DefaultWeatherStationId.ShouldBe(stations[0].Id);
    }

    [Fact]
    public async Task FirstSyncWithMultipleDevicesShouldMarkFirstDeviceAsPrimary()
    {
        var subject = UniqueSubject();

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);

        var stations = await repo.SyncStationsAsync(subject, null,
            [Device("AA:BB:CC:DD:02:01", "Alpha"), Device("AA:BB:CC:DD:02:02", "Beta")]);

        stations.Count.ShouldBe(2);
        stations.Count(s => s.IsPrimary).ShouldBe(1);
        stations.First(s => s.IsPrimary).Name.ShouldBe("Alpha");
    }

    // -----------------------------------------------------------------------
    // SyncStationsAsync — resync preserves user-managed fields
    // -----------------------------------------------------------------------

    [Fact]
    public async Task ResyncShouldPreserveNicknameAndDashboardVisibility()
    {
        var subject = UniqueSubject();

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);
        var initial = await repo.SyncStationsAsync(subject, null,
            [Device("AA:BB:CC:DD:03:01", "Original Name")]);

        // User customises.
        var station = await ctx.WeatherStations.FindAsync(initial[0].Id);
        station!.Nickname = "My Station";
        station.DisplayOnDashboard = false;
        await ctx.SaveChangesAsync();

        // Resync with a provider-updated name.
        await using var ctx2 = CreateContext();
        var repo2 = new WeatherStationRepository(ctx2);
        var after = await repo2.SyncStationsAsync(subject, null,
            [Device("AA:BB:CC:DD:03:01", "Renamed By Provider")]);

        after.Count.ShouldBe(1);
        after[0].Name.ShouldBe("Renamed By Provider");  // provider field updated
        after[0].Nickname.ShouldBe("My Station");        // user field preserved
        after[0].DisplayOnDashboard.ShouldBeFalse();     // user field preserved
    }

    [Fact]
    public async Task ResyncShouldPreserveExistingPrimaryChoiceAndNotResetDefault()
    {
        var subject = UniqueSubject();

        // First sync — Alpha is primary.
        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);
        var initial = await repo.SyncStationsAsync(subject, null,
            [Device("AA:BB:CC:DD:04:01", "Alpha"), Device("AA:BB:CC:DD:04:02", "Beta")]);
        var alphaId = initial.First(s => string.Equals(s.Name, "Alpha", StringComparison.Ordinal)).Id;
        var betaId = initial.First(s => string.Equals(s.Name, "Beta", StringComparison.Ordinal)).Id;

        // User promotes Beta.
        await using var ctx2 = CreateContext();
        var repo2 = new WeatherStationRepository(ctx2);
        var beta = await ctx2.WeatherStations.FindAsync(betaId);
        beta!.IsPrimary = true;
        await repo2.SaveAsync(beta);

        // Resync — Beta must still be primary; default must still be Beta.
        await using var ctx3 = CreateContext();
        var repo3 = new WeatherStationRepository(ctx3);
        var afterResync = await repo3.SyncStationsAsync(subject, null,
            [Device("AA:BB:CC:DD:04:01", "Alpha"), Device("AA:BB:CC:DD:04:02", "Beta")]);

        afterResync.Count(s => s.IsPrimary).ShouldBe(1);
        afterResync.First(s => s.IsPrimary).Name.ShouldBe("Beta");

        var prefs = await GetPrefsAsync(subject);
        prefs!.DefaultWeatherStationId.ShouldBe(betaId,
            "DefaultWeatherStationId must not be reset to Alpha after resync");

        _ = alphaId; // not needed further
    }

    // -----------------------------------------------------------------------
    // SaveAsync — primary promotion clears old primary and repairs default
    // -----------------------------------------------------------------------

    [Fact]
    public async Task SaveAsyncShouldClearOldPrimaryWhenAnotherStationIsPromoted()
    {
        var subject = UniqueSubject();

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);
        await repo.SyncStationsAsync(subject, null,
            [Device("AA:BB:CC:DD:05:01", "Alpha"), Device("AA:BB:CC:DD:05:02", "Beta")]);

        // Promote Beta.
        await using var ctx2 = CreateContext();
        var repo2 = new WeatherStationRepository(ctx2);
        var beta = await ctx2.WeatherStations
            .FirstAsync(s => s.MacAddress == "AABBCCDD0502");
        beta.IsPrimary = true;
        await repo2.SaveAsync(beta);

        // Verify only Beta is primary now.
        await using var ctx3 = CreateContext();
        var userId = await GetUserIdAsync(subject);
        var stations = await ctx3.WeatherStations
            .Where(s => s.UserId == userId)
            .ToListAsync();

        stations.Count(s => s.IsPrimary).ShouldBe(1);
        stations.First(s => s.IsPrimary).Name.ShouldBe("Beta");
    }

    [Fact]
    public async Task SaveAsyncShouldRepairDefaultWeatherStationIdWhenPrimaryPromoted()
    {
        var subject = UniqueSubject();

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);
        var initial = await repo.SyncStationsAsync(subject, null,
            [Device("AA:BB:CC:DD:06:01", "Alpha"), Device("AA:BB:CC:DD:06:02", "Beta")]);
        var alphaId = initial.First(s => string.Equals(s.Name, "Alpha", StringComparison.Ordinal)).Id;
        var betaId = initial.First(s => string.Equals(s.Name, "Beta", StringComparison.Ordinal)).Id;

        // After first sync, DefaultWeatherStationId = Alpha.
        var prefsInitial = await GetPrefsAsync(subject);
        prefsInitial!.DefaultWeatherStationId.ShouldBe(alphaId);

        // Promote Beta → default must be repaired to Beta.
        await using var ctx2 = CreateContext();
        var repo2 = new WeatherStationRepository(ctx2);
        var beta = await ctx2.WeatherStations.FindAsync(betaId);
        beta!.IsPrimary = true;
        await repo2.SaveAsync(beta);

        var prefsAfter = await GetPrefsAsync(subject);
        prefsAfter!.DefaultWeatherStationId.ShouldBe(betaId);
    }

    // -----------------------------------------------------------------------
    // GetDefaultStationAsync — resolution and fallback
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetDefaultStationAsyncShouldReturnPreferencesDefaultWhenSet()
    {
        var subject = UniqueSubject();

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);
        var synced = await repo.SyncStationsAsync(subject, null,
            [Device("AA:BB:CC:DD:07:01", "Home")]);

        await using var ctx2 = CreateContext();
        var repo2 = new WeatherStationRepository(ctx2);
        var result = await repo2.GetDefaultStationAsync(subject);

        result.ShouldNotBeNull();
        result!.Id.ShouldBe(synced[0].Id);
    }

    [Fact]
    public async Task GetDefaultStationAsyncShouldReturnConfiguredDefaultEvenWhenIsPrimaryIsFalse()
    {
        var subject = UniqueSubject();

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);
        var synced = await repo.SyncStationsAsync(subject, null,
            [Device("AA:BB:CC:DD:07:11", "Home")]);
        var stationId = synced[0].Id;

        // Force the configured default to have IsPrimary = false (simulates data skew).
        await ctx.WeatherStations
            .Where(s => s.Id == stationId)
            .ExecuteUpdateAsync(s => s.SetProperty(station => station.IsPrimary, false));

        await using var ctx2 = CreateContext();
        var repo2 = new WeatherStationRepository(ctx2);
        var result = await repo2.GetDefaultStationAsync(subject);

        // The configured default is returned; the read path does not modify IsPrimary.
        result.ShouldNotBeNull();
        result!.Id.ShouldBe(stationId);
    }

    [Fact]
    public async Task GetDefaultStationAsyncShouldFallBackToPrimaryAndRepairStaleDefault()
    {
        var subject = UniqueSubject();

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);
        var synced = await repo.SyncStationsAsync(subject, null,
            [Device("AA:BB:CC:DD:08:01", "Patio")]);
        var stationId = synced[0].Id;

        // Simulate stale/null default.
        var userId = await GetUserIdAsync(subject);
        await ctx.UserPreferences
            .Where(p => p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.DefaultWeatherStationId, (Guid?)null));

        // GetDefaultStationAsync must fall back to primary and repair the pointer.
        await using var ctx2 = CreateContext();
        var repo2 = new WeatherStationRepository(ctx2);
        var result = await repo2.GetDefaultStationAsync(subject);

        result.ShouldNotBeNull();
        result!.Id.ShouldBe(stationId);

        // Verify pointer was repaired.
        var prefs = await GetPrefsAsync(subject);
        prefs!.DefaultWeatherStationId.ShouldBe(stationId);
    }

    [Fact]
    public async Task GetDefaultStationAsyncShouldMarkFallbackStationPrimaryWhenNoPrimaryExists()
    {
        var subject = UniqueSubject();
        var userId = Guid.NewGuid();

        await using (var setup = CreateContext())
        {
            setup.Users.Add(new AppUser
            {
                Id = userId,
                AuthProviderSubject = subject,
            });
            setup.WeatherStations.AddRange(
                new WeatherStation
                {
                    UserId = userId,
                    MacAddress = "AABBCCDD0902",
                    Name = "Zulu",
                    IsPrimary = false,
                },
                new WeatherStation
                {
                    UserId = userId,
                    MacAddress = "AABBCCDD0901",
                    Name = "Alpha",
                    IsPrimary = false,
                });
            await setup.SaveChangesAsync();
        }

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);
        var result = await repo.GetDefaultStationAsync(subject);

        result.ShouldNotBeNull();
        result!.Name.ShouldBe("Alpha");

        await using var verify = CreateContext();
        var stations = await verify.WeatherStations
            .Where(s => s.UserId == userId)
            .ToListAsync();
        stations.Count(s => s.IsPrimary).ShouldBe(1);
        stations.Single(s => s.IsPrimary).Name.ShouldBe("Alpha");

        var prefs = await GetPrefsAsync(subject);
        prefs.ShouldNotBeNull();
        prefs!.DefaultWeatherStationId.ShouldBe(result.Id);
    }

    [Fact]
    public async Task GetDefaultStationAsyncShouldReturnNullWhenNoStationsExist()
    {
        var subject = UniqueSubject();

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);
        var result = await repo.GetDefaultStationAsync(subject);

        result.ShouldBeNull();
    }

    [Fact]
    public async Task SaveAsyncShouldCreatePreferencesWhenPrimaryPromotedAndPreferencesMissing()
    {
        var subject = UniqueSubject();
        var userId = Guid.NewGuid();
        var stationId = Guid.NewGuid();

        await using (var setup = CreateContext())
        {
            setup.Users.Add(new AppUser
            {
                Id = userId,
                AuthProviderSubject = subject,
            });
            setup.WeatherStations.Add(new WeatherStation
            {
                Id = stationId,
                UserId = userId,
                MacAddress = "AABBCCDD1001",
                Name = "Legacy",
                IsPrimary = false,
            });
            await setup.SaveChangesAsync();
        }

        await using var ctx = CreateContext();
        var repo = new WeatherStationRepository(ctx);
        var station = await ctx.WeatherStations.FindAsync(stationId);
        station!.IsPrimary = true;
        await repo.SaveAsync(station);

        var prefs = await GetPrefsAsync(subject);
        prefs.ShouldNotBeNull();
        prefs!.DefaultWeatherStationId.ShouldBe(stationId);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private AmbientWeatherDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AmbientWeatherDbContext>()
            .UseNpgsql(fixture.ConnectionString)
            .Options;
        return new AmbientWeatherDbContext(options);
    }

    private async Task<Guid> GetUserIdAsync(string subject)
    {
        await using var ctx = CreateContext();
        var user = await ctx.Users.FirstAsync(u => u.AuthProviderSubject == subject);
        return user.Id;
    }

    private async Task<UserPreferences?> GetPrefsAsync(string subject)
    {
        await using var ctx = CreateContext();
        var userId = await ctx.Users
            .Where(u => u.AuthProviderSubject == subject)
            .Select(u => (Guid?)u.Id)
            .FirstOrDefaultAsync();

        if (userId == null) return null;

        return await ctx.UserPreferences
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId.Value);
    }

    private static string UniqueSubject() => $"test|{Guid.NewGuid():N}";

    private static DeviceDto Device(string mac, string name) => new()
    {
        MacAddress = mac,
        Info = new DeviceInfoDto { Name = name },
        LastData = new DeviceDataDto { DateUtc = 0 },
    };
}
