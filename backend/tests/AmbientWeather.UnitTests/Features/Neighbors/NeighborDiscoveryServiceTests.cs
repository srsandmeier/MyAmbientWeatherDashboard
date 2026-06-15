using System.Text.Json;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Neighbors;
using AmbientWeather.Infrastructure.Data;
using AmbientWeather.Infrastructure.Neighbors;
using Bogus;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Neighbors;

public sealed class NeighborDiscoveryServiceTests
{
    private const string UserHash = "test-user-hash";

    private static readonly Faker F = new();

    private static readonly System.Text.Json.JsonSerializerOptions CamelCaseOptions = new()
    {
        PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
    };

    private static readonly NeighborConfig DefaultConfig = new()
    {
        UserLatitude = F.Address.Latitude(),
        UserLongitude = F.Address.Longitude(),
        IsEnabled = true,
        RadiusMiles = 25,
        MaxAgeMinutes = 60,
        RefreshIntervalMinutes = 15,
    };

    private static NeighborStation MakeStation(
        string provider = "WeatherGov",
        string sourceId = "station-1",
        double distanceMiles = 5.0,
        DateTime? lastObservedAt = null) => new()
        {
            Provider = provider,
            SourceId = sourceId,
            Lat = F.Address.Latitude(),
            Lon = F.Address.Longitude(),
            DistanceMiles = distanceMiles,
            LastObservedAtUtc = lastObservedAt ?? DateTime.UtcNow.AddMinutes(-5),
        };

    private static AmbientWeatherDbContext CreateNoProviderDbContext()
    {
        // No database provider configured — PersistAsync will catch and log the exception,
        // so tests can verify discovery logic without a real database.
        var options = new DbContextOptionsBuilder<AmbientWeatherDbContext>().Options;
        return new AmbientWeatherDbContext(options);
    }

    private static NeighborDiscoveryService CreateService(
        IReadOnlyList<INearbyWeatherProvider> providers,
        IDistributedCache cache) =>
        new(providers, cache, CreateNoProviderDbContext(), NullLogger<NeighborDiscoveryService>.Instance);

    // -----------------------------------------------------------------------
    // Cache hit — providers must not be called
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CacheHitShouldReturnCachedStationsWithoutCallingProviders()
    {
        var cached = new List<NeighborStation> { MakeStation() };
        var cachedJson = JsonSerializer.Serialize(cached, CamelCaseOptions);

        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(System.Text.Encoding.UTF8.GetBytes(cachedJson));

        var providerMock = new Mock<INearbyWeatherProvider>();

        var service = CreateService([providerMock.Object], cacheMock.Object);

        var result = await service.GetOrDiscoverAsync(UserHash, DefaultConfig);

        result.Count.ShouldBe(1);
        providerMock.Verify(p => p.DiscoverAsync(It.IsAny<NeighborConfig>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // -----------------------------------------------------------------------
    // Cache miss — providers are called
    // -----------------------------------------------------------------------

    [Fact]
    public async Task CacheMissShouldCallProvidersAndReturnDiscoveredStations()
    {
        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[]?)null);

        var providerMock = new Mock<INearbyWeatherProvider>();
        providerMock.Setup(p => p.ProviderName).Returns("WeatherGov");
        providerMock
            .Setup(p => p.DiscoverAsync(DefaultConfig, It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeStation()]);

        var service = CreateService([providerMock.Object], cacheMock.Object);

        var result = await service.GetOrDiscoverAsync(UserHash, DefaultConfig);

        result.Count.ShouldBe(1);
        providerMock.Verify(p => p.DiscoverAsync(DefaultConfig, It.IsAny<CancellationToken>()), Times.Once);
    }

    // -----------------------------------------------------------------------
    // Deduplication
    // -----------------------------------------------------------------------

    [Fact]
    public async Task DuplicateProviderSourceIdShouldBeDeduplicated()
    {
        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[]?)null);

        var provider1 = new Mock<INearbyWeatherProvider>();
        provider1.Setup(p => p.ProviderName).Returns("WeatherGov");
        provider1
            .Setup(p => p.DiscoverAsync(DefaultConfig, It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeStation(provider: "WeatherGov", sourceId: "A")]);

        var provider2 = new Mock<INearbyWeatherProvider>();
        provider2.Setup(p => p.ProviderName).Returns("OpenMeteo");
        provider2
            .Setup(p => p.DiscoverAsync(DefaultConfig, It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                MakeStation(provider: "WeatherGov", sourceId: "A"),  // duplicate
                MakeStation(provider: "OpenMeteo", sourceId: "B"),
            ]);

        var service = CreateService([provider1.Object, provider2.Object], cacheMock.Object);

        var result = await service.GetOrDiscoverAsync(UserHash, DefaultConfig);

        result.Count.ShouldBe(2);
        result.Select(s => $"{s.Provider}:{s.SourceId}").ShouldBeUnique();
    }

    // -----------------------------------------------------------------------
    // Freshness filter
    // -----------------------------------------------------------------------

    [Fact]
    public async Task StaleStationsShouldBeExcluded()
    {
        var config = DefaultConfig with { MaxAgeMinutes = 30 };

        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[]?)null);

        var providerMock = new Mock<INearbyWeatherProvider>();
        providerMock.Setup(p => p.ProviderName).Returns("WeatherGov");
        providerMock
            .Setup(p => p.DiscoverAsync(config, It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                MakeStation(sourceId: "fresh", lastObservedAt: DateTime.UtcNow.AddMinutes(-10)),
                MakeStation(sourceId: "stale", lastObservedAt: DateTime.UtcNow.AddMinutes(-60)),
            ]);

        var service = CreateService([providerMock.Object], cacheMock.Object);

        var result = await service.GetOrDiscoverAsync(UserHash, config);

        result.Count.ShouldBe(1);
        result[0].SourceId.ShouldBe("fresh");
    }

    // -----------------------------------------------------------------------
    // Cache invalidation
    // -----------------------------------------------------------------------

    [Fact]
    public async Task InvalidateCacheAsyncShouldRemoveCacheKey()
    {
        var cacheMock = new Mock<IDistributedCache>();

        var service = CreateService([], cacheMock.Object);

        await service.InvalidateCacheAsync(UserHash);

        cacheMock.Verify(
            c => c.RemoveAsync(It.Is<string>(k => k.Contains(UserHash)), It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
