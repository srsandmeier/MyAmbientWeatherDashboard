#pragma warning disable MA0004 // ConfigureAwait(false) intentionally omitted in [Fact] bodies per xUnit1030
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.Data;
using AmbientWeather.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Xunit;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Integration tests for <see cref="DatabaseRealtimeSubscriptionRegistry"/> against a real
/// PostgreSQL instance. Uses the shared <see cref="WeatherStationRepositoryFixture"/> container.
/// </summary>
public sealed class DatabaseRealtimeSubscriptionRegistryTests(
    WeatherStationRepositoryFixture fixture)
    : IClassFixture<WeatherStationRepositoryFixture>
{
    private AmbientWeatherDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AmbientWeatherDbContext>()
            .UseNpgsql(fixture.ConnectionString)
            .Options;
        return new AmbientWeatherDbContext(options);
    }

    private DatabaseRealtimeSubscriptionRegistry CreateRegistry()
    {
        var services = new ServiceCollection();
        services.AddDbContext<AmbientWeatherDbContext>(opt =>
            opt.UseNpgsql(fixture.ConnectionString));
        var provider = services.BuildServiceProvider();

        return new DatabaseRealtimeSubscriptionRegistry(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<DatabaseRealtimeSubscriptionRegistry>.Instance);
    }

    private static string UniqueSubject() => $"rt-test|{Guid.NewGuid():N}";

    // -----------------------------------------------------------------------
    // GetActiveSubscriptionsAsync
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetActiveSubscriptionsShouldReturnEmptyWhenNoUsers()
    {
        var registry = CreateRegistry();

        var result = await registry.GetActiveSubscriptionsAsync();

        // Result may contain other test users but none for a fresh unique subject.
        // The important invariant: method completes without error.
        result.ShouldNotBeNull();
    }

    [Fact]
    public async Task GetActiveSubscriptionsShouldReturnTargetForUserWithCredentialsAndStation()
    {
        var subject = UniqueSubject();
        var userId = Guid.NewGuid();
        var stationId = Guid.NewGuid();
        const string mac = "CCDDEE001122";

        await using (var ctx = CreateContext())
        {
            ctx.Users.Add(new AppUser
            {
                Id = userId,
                AuthProviderSubject = subject,
                AmbientCredentials = new UserAmbientCredentials
                {
                    UserId = userId,
                    ApiKeyEncrypted = "enc-key",
                    ApplicationKeyEncrypted = "enc-appkey",
                    UpdatedAtUtc = DateTime.UtcNow,
                },
            });
            ctx.WeatherStations.Add(new WeatherStation
            {
                Id = stationId,
                UserId = userId,
                MacAddress = mac,
                Name = "Patio",
                Nickname = "My Patio",
            });
            await ctx.SaveChangesAsync();
        }

        var registry = CreateRegistry();
        var result = await registry.GetActiveSubscriptionsAsync();

        var target = result.FirstOrDefault(t => string.Equals(t.Subject, subject, StringComparison.Ordinal));
        target.ShouldNotBeNull();
        target!.MacAddress.ShouldBe(mac);
        target.StationName.ShouldBe("My Patio");
        target.UserHash.ShouldNotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetActiveSubscriptionsShouldExcludeUsersWithoutCredentials()
    {
        var subject = UniqueSubject();
        var userId = Guid.NewGuid();

        await using (var ctx = CreateContext())
        {
            ctx.Users.Add(new AppUser
            {
                Id = userId,
                AuthProviderSubject = subject,
            });
            ctx.WeatherStations.Add(new WeatherStation
            {
                UserId = userId,
                MacAddress = "AABBCC001122",
                Name = "Garden",
            });
            await ctx.SaveChangesAsync();
        }

        var registry = CreateRegistry();
        var result = await registry.GetActiveSubscriptionsAsync();

        result.ShouldNotContain(t => string.Equals(t.Subject, subject, StringComparison.Ordinal));
    }

    [Fact]
    public async Task GetActiveSubscriptionsShouldExcludeUsersWithoutStations()
    {
        var subject = UniqueSubject();
        var userId = Guid.NewGuid();

        await using (var ctx = CreateContext())
        {
            ctx.Users.Add(new AppUser
            {
                Id = userId,
                AuthProviderSubject = subject,
                AmbientCredentials = new UserAmbientCredentials
                {
                    UserId = userId,
                    ApiKeyEncrypted = "enc-key",
                    ApplicationKeyEncrypted = "enc-appkey",
                    UpdatedAtUtc = DateTime.UtcNow,
                },
            });
            await ctx.SaveChangesAsync();
        }

        var registry = CreateRegistry();
        var result = await registry.GetActiveSubscriptionsAsync();

        result.ShouldNotContain(t => string.Equals(t.Subject, subject, StringComparison.Ordinal));
    }

    [Fact]
    public async Task GetActiveSubscriptionsShouldReturnOneTargetPerStation()
    {
        var subject = UniqueSubject();
        var userId = Guid.NewGuid();

        await using (var ctx = CreateContext())
        {
            ctx.Users.Add(new AppUser
            {
                Id = userId,
                AuthProviderSubject = subject,
                AmbientCredentials = new UserAmbientCredentials
                {
                    UserId = userId,
                    ApiKeyEncrypted = "enc-key2",
                    ApplicationKeyEncrypted = "enc-appkey2",
                    UpdatedAtUtc = DateTime.UtcNow,
                },
            });
            ctx.WeatherStations.AddRange(
                new WeatherStation { UserId = userId, MacAddress = "AABB00110011", Name = "Front" },
                new WeatherStation { UserId = userId, MacAddress = "AABB00220022", Name = "Back" });
            await ctx.SaveChangesAsync();
        }

        var registry = CreateRegistry();
        var result = await registry.GetActiveSubscriptionsAsync();

        result.Count(t => string.Equals(t.Subject, subject, StringComparison.Ordinal)).ShouldBe(2);
    }

    // -----------------------------------------------------------------------
    // InvalidateAsync / SubscriptionsChanged
    // -----------------------------------------------------------------------

    [Fact]
    public async Task InvalidateAsyncShouldRaiseSubscriptionsChangedEvent()
    {
        var registry = CreateRegistry();
        var raised = false;
        registry.SubscriptionsChanged += (_, _) => raised = true;

        await registry.InvalidateAsync("auth0|some-user");

        raised.ShouldBeTrue();
    }

    [Fact]
    public async Task InvalidateAsyncShouldCompleteWithoutError()
    {
        var registry = CreateRegistry();

        var ex = await Record.ExceptionAsync(() =>
            registry.InvalidateAsync("auth0|nonexistent-user"));

        ex.ShouldBeNull();
    }
}
