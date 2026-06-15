#pragma warning disable MA0004 // ConfigureAwait(false) intentionally omitted in [Fact] bodies per xUnit1030
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Testcontainers.PostgreSql;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Shared Postgres container for <see cref="SchemaInvariantTests"/>.
/// Using <c>IClassFixture</c> instead of implementing <c>IAsyncLifetime</c> directly on the
/// test class means one container is started for all five tests instead of five.
/// </summary>
public sealed class SchemaInvariantFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

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
/// Verifies that the database constraints added in <c>AddSchemaInvariants</c> are enforced:
/// one active layout per user, one primary station per user, and the FK from
/// <c>user_preferences.default_weather_station_id</c> to <c>weather_stations.id</c>.
/// All tests share a single migrated Postgres container via <see cref="SchemaInvariantFixture"/>.
/// Each test creates its own user with a unique subject so tests are fully independent.
/// </summary>
public sealed class SchemaInvariantTests(SchemaInvariantFixture fixture)
    : IClassFixture<SchemaInvariantFixture>
{
    [Fact]
    public async Task DashboardLayoutsShouldEnforceOneActiveLayoutPerUser()
    {
        await using var ctx = CreateMigratedContext();
        var user = SeedUser(ctx);
        await ctx.SaveChangesAsync();

        ctx.DashboardLayouts.AddRange(
            new DashboardLayout { UserId = user.Id, Name = "A", IsActive = true, LayoutJson = "[]" },
            new DashboardLayout { UserId = user.Id, Name = "B", IsActive = true, LayoutJson = "[]" });

        await Should.ThrowAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [Fact]
    public async Task WeatherStationsShouldEnforceOnePrimaryStationPerUser()
    {
        await using var ctx = CreateMigratedContext();
        var user = SeedUser(ctx);
        await ctx.SaveChangesAsync();

        ctx.WeatherStations.AddRange(
            new WeatherStation { UserId = user.Id, MacAddress = "AA:BB:CC:DD:EE:01", IsPrimary = true },
            new WeatherStation { UserId = user.Id, MacAddress = "AA:BB:CC:DD:EE:02", IsPrimary = true });

        await Should.ThrowAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [Fact]
    public async Task UserPreferencesShouldEnforceDefaultWeatherStationFk()
    {
        await using var ctx = CreateMigratedContext();
        var user = SeedUser(ctx);
        await ctx.SaveChangesAsync();

        ctx.UserPreferences.Add(new UserPreferences
        {
            UserId = user.Id,
            DefaultWeatherStationId = Guid.NewGuid(),
        });

        await Should.ThrowAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [Fact]
    public async Task DashboardLayoutsShouldAllowOneActiveAndOneInactiveLayoutPerUser()
    {
        await using var ctx = CreateMigratedContext();
        var user = SeedUser(ctx);

        ctx.DashboardLayouts.AddRange(
            new DashboardLayout { UserId = user.Id, Name = "Active", IsActive = true, LayoutJson = "[]" },
            new DashboardLayout { UserId = user.Id, Name = "Inactive", IsActive = false, LayoutJson = "[]" });

        var ex = await Record.ExceptionAsync(() => ctx.SaveChangesAsync());
        ex.ShouldBeNull();
    }

    [Fact]
    public async Task WeatherStationsShouldAllowOnePrimaryAndOneNonPrimaryPerUser()
    {
        await using var ctx = CreateMigratedContext();
        var user = SeedUser(ctx);

        ctx.WeatherStations.AddRange(
            new WeatherStation { UserId = user.Id, MacAddress = "AA:BB:CC:DD:EE:01", IsPrimary = true },
            new WeatherStation { UserId = user.Id, MacAddress = "AA:BB:CC:DD:EE:02", IsPrimary = false });

        var ex = await Record.ExceptionAsync(() => ctx.SaveChangesAsync());
        ex.ShouldBeNull();
    }

    private AmbientWeatherDbContext CreateMigratedContext()
    {
        var options = new DbContextOptionsBuilder<AmbientWeatherDbContext>()
            .UseNpgsql(fixture.ConnectionString)
            .Options;
        return new AmbientWeatherDbContext(options);
    }

    private static AppUser SeedUser(AmbientWeatherDbContext ctx)
    {
        var user = new AppUser { Id = Guid.NewGuid(), AuthProviderSubject = $"test|{Guid.NewGuid():N}" };
        ctx.Users.Add(user);
        return user;
    }
}
