using AmbientWeather.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Testcontainers.PostgreSql;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Verifies the EF Core migration applies cleanly to a real PostgreSQL database.
/// </summary>
public sealed class MigrationTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    /// <inheritdoc />
    public async Task InitializeAsync() => await _postgres.StartAsync().ConfigureAwait(false);

    /// <inheritdoc />
    public async Task DisposeAsync() => await _postgres.DisposeAsync().ConfigureAwait(false);

    [Fact]
    public async Task InitialMigrationShouldApplyWithoutError()
    {
        var options = new DbContextOptionsBuilder<AmbientWeatherDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        await using var dbContext = new AmbientWeatherDbContext(options);

        var exception = await Record.ExceptionAsync(
            () => dbContext.Database.MigrateAsync());

        exception.ShouldBeNull();

        var appliedMigrations = await dbContext.Database.GetAppliedMigrationsAsync();

        appliedMigrations.ShouldContain(m => m.Contains("InitialCreate"));
    }
}
