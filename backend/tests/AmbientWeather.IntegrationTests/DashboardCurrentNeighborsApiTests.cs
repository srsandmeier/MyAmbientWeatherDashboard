using AmbientWeather.UnitTests.TestData;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Domain.Neighbors;
using AmbientWeather.Infrastructure.Neighbors;
using AmbientWeather.IntegrationTests.Auth;
using Bogus;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Shouldly;
using Xunit.Abstractions;
using Xunit;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Integration tests for <c>GET /api/dashboard/current?source=neighbors</c>.
/// </summary>
public sealed class DashboardCurrentNeighborsApiTests : IClassFixture<DashboardCurrentNeighborsTestFactory>
{
    private const string UserSubject = "auth0|dashboard-neighbors-test";

    private readonly DashboardCurrentNeighborsTestFactory _factory;
    private readonly ITestOutputHelper _output;

    public DashboardCurrentNeighborsApiTests(
        DashboardCurrentNeighborsTestFactory factory,
        ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
        _factory.PrefStoreMock.Reset();
        _factory.StationStoreMock.Reset();
        _factory.DiscoveryServiceMock.Reset();
        _factory.AggregationServiceMock.Reset();
        _factory.CredentialStoreMock.Reset();
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("api-key", "application-key"));
    }

    private HttpClient AuthClient() => _factory.CreateAuthenticatedClient(UserSubject);

    // -----------------------------------------------------------------------
    // Auth
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetCurrentNeighborsShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/dashboard/current?source=neighbors");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // -----------------------------------------------------------------------
    // 428 — feature disabled
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetCurrentNeighborsShouldReturn428WhenFeatureDisabled()
    {
        _factory.PrefStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences
            {
                NeighborConfigJson =
                    """{"isEnabled":false,"radiusMiles":25,"maxAgeMinutes":30,"minStations":3,"enabledProviders":["WeatherGov"],"refreshIntervalMinutes":15}""",
            });

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/current?source=neighbors");

        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    // -----------------------------------------------------------------------
    // 428 — no station coordinates
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetCurrentNeighborsShouldReturn428WhenNoCoordinates()
    {
        _factory.PrefStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences
            {
                NeighborConfigJson =
                    """{"isEnabled":true,"radiusMiles":25,"maxAgeMinutes":30,"minStations":3,"enabledProviders":["WeatherGov"],"refreshIntervalMinutes":15}""",
            });

        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation
            {
                MacAddress = WeatherTestData.Mac,
                Name = WeatherTestData.StationName,
                Latitude = null,
                Longitude = null,
            });

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/current?source=neighbors");

        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    [Fact]
    public async Task GetCurrentNeighborsShouldReturn428WhenDefaultStationIsNotEnabled()
    {
        var enabledMac = $"ENABLED-{Guid.NewGuid():N}";
        _factory.PrefStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences
            {
                NeighborConfigJson =
                    $$"""{"isEnabled":true,"enabledStationMacAddresses":["{{enabledMac}}"],"radiusMiles":25,"maxAgeMinutes":30,"minStations":3,"enabledProviders":["WeatherGov"],"refreshIntervalMinutes":15}""",
            });

        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation
            {
                MacAddress = WeatherTestData.Mac,
                Name = WeatherTestData.StationName,
                Latitude = 39.7392,
                Longitude = -104.9903,
            });

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/current?source=neighbors");

        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    // -----------------------------------------------------------------------
    // 200 — aggregated reading returned
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetCurrentNeighborsShouldReturn200WithAggregatedReading()
    {
        NeighborConfig? discoveryConfig = null;
        _factory.PrefStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences
            {
                NeighborConfigJson =
                    $$"""{"isEnabled":true,"enabledStationMacAddresses":["{{WeatherTestData.Mac}}"],"radiusMiles":25,"comparisonRadiusMiles":12.5,"maxAgeMinutes":30,"minStations":3,"enabledProviders":["WeatherGov","OpenMeteo"],"refreshIntervalMinutes":15}""",
            });

        var f = new Faker();
        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation
            {
                MacAddress = WeatherTestData.Mac,
                Name = WeatherTestData.StationName,
                Latitude = f.Address.Latitude(),
                Longitude = f.Address.Longitude(),
            });

        _factory.DiscoveryServiceMock
            .Setup(d => d.GetOrDiscoverAsync(It.IsAny<string>(), It.IsAny<NeighborConfig>(), It.IsAny<CancellationToken>()))
            .Callback<string, NeighborConfig, CancellationToken>((_, config, _) => { discoveryConfig = config; })
            .ReturnsAsync([new NeighborStation
            {
                Provider = "AmbientOpen",
                SourceId = f.Random.AlphaNumeric(4).ToUpperInvariant(),
                Lat = f.Address.Latitude(),
                Lon = f.Address.Longitude(),
                DistanceMiles = 5.0,
                TempF = 72.0,
                LastObservedAtUtc = DateTime.UtcNow.AddMinutes(-5),
            }]);

        _factory.AggregationServiceMock
            .Setup(a => a.Aggregate(It.IsAny<IReadOnlyList<NeighborStation>>(), It.IsAny<int>()))
            .Returns(new AggregatedNeighborReadingDto
            {
                ContributingStationCount = 1,
                IsBelowMinStations = true,
                TempF = 72.0,
            });

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/current?source=neighbors");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<CurrentReadingDto>();
        dto.ShouldNotBeNull();
        dto.Source.ShouldBe("neighbors");
        dto.TempF.ShouldBe(72.0);
        discoveryConfig.ShouldNotBeNull();
        discoveryConfig.RadiusMiles.ShouldBe(12.5);
        discoveryConfig.EnabledProviders.ShouldBe(["AmbientOpen"]);
    }

    [Fact]
    public async Task GetCurrentNeighborsShouldReturn200WithEmptyAggregateWhenNoStationsFound()
    {
        _factory.PrefStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences
            {
                NeighborConfigJson =
                    $$"""{"isEnabled":true,"enabledStationMacAddresses":["{{WeatherTestData.Mac}}"],"radiusMiles":25,"comparisonRadiusMiles":0.5,"maxAgeMinutes":30,"minStations":3,"enabledProviders":["WeatherGov","OpenMeteo"],"refreshIntervalMinutes":15}""",
            });

        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation
            {
                MacAddress = WeatherTestData.Mac,
                Name = WeatherTestData.StationName,
                Latitude = 39.7392,
                Longitude = -104.9903,
            });

        _factory.DiscoveryServiceMock
            .Setup(d => d.GetOrDiscoverAsync(It.IsAny<string>(), It.IsAny<NeighborConfig>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        _factory.AggregationServiceMock
            .Setup(a => a.Aggregate(It.IsAny<IReadOnlyList<NeighborStation>>(), It.IsAny<int>()))
            .Returns(new AggregatedNeighborReadingDto
            {
                ContributingStationCount = 0,
                IsBelowMinStations = true,
            });

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/current?source=neighbors");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<CurrentReadingDto>();
        dto.ShouldNotBeNull();
        dto.Source.ShouldBe("neighbors");
        dto.DeviceName.ShouldBe("0 nearby stations");
        dto.TempF.ShouldBeNull();
    }

    [Fact]
    public async Task GetCurrentNeighborsBenchmarkShouldStayBelowAssembledCacheThreshold()
    {
        const int requestCount = 100;
        var stations = CreateRepresentativeNeighborStations();
        var aggregator = new NeighborAggregationService();

        _factory.PrefStoreMock
            .Setup(s => s.GetOrCreateAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences
            {
                NeighborConfigJson =
                    """{"isEnabled":true,"radiusMiles":25,"maxAgeMinutes":30,"minStations":3,"enabledProviders":["WeatherGov","OpenMeteo","AmbientOpen"],"refreshIntervalMinutes":15}""",
            });

        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation
            {
                MacAddress = WeatherTestData.Mac,
                Name = WeatherTestData.StationName,
                Latitude = 39.7392,
                Longitude = -104.9903,
            });

        _factory.DiscoveryServiceMock
            .Setup(d => d.GetOrDiscoverAsync(It.IsAny<string>(), It.IsAny<NeighborConfig>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(stations);

        _factory.AggregationServiceMock
            .Setup(a => a.Aggregate(It.IsAny<IReadOnlyList<NeighborStation>>(), It.IsAny<int>()))
            .Returns((IReadOnlyList<NeighborStation> s, int minStations) => aggregator.Aggregate(s, minStations));

        using var client = _factory.CreateClient();
        using var warmup = await SendBenchmarkRequestAsync(client, -1);
        warmup.StatusCode.ShouldBe(HttpStatusCode.OK);

        var timings = new List<double>(requestCount);
        for (var i = 0; i < requestCount; i++)
        {
            var started = Stopwatch.GetTimestamp();
            using var response = await SendBenchmarkRequestAsync(client, i);
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            timings.Add(Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        }

        timings.Sort();
        var p50 = Percentile(timings, 0.50);
        var p95 = Percentile(timings, 0.95);
        _output.WriteLine(
            $"Phase 11 Section 8C benchmark: {requestCount} requests, cached neighbor dataset, p50={p50:F2} ms, p95={p95:F2} ms.");

        p95.ShouldBeLessThan(200.0);
    }

    private static Task<HttpResponseMessage> SendBenchmarkRequestAsync(HttpClient client, int requestIndex)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/dashboard/current?source=neighbors");
        request.Headers.Add(TestAuthHandler.UserSubjectHeader, $"auth0|dashboard-neighbors-benchmark-{requestIndex}");
        return client.SendAsync(request);
    }

    private static double Percentile(List<double> sortedValues, double percentile)
    {
        var index = Math.Min(
            sortedValues.Count - 1,
            Math.Max(0, (int)Math.Ceiling(sortedValues.Count * percentile) - 1));
        return sortedValues[index];
    }

    private static List<NeighborStation> CreateRepresentativeNeighborStations() =>
        Enumerable.Range(0, 12)
            .Select(i => new NeighborStation
            {
                Provider = i % 3 == 0 ? "AmbientOpen" : i % 3 == 1 ? "WeatherGov" : "OpenMeteo",
                SourceId = $"REP-{i:00}",
                Name = $"Representative Station {i:00}",
                Lat = 39.7392 + (i * 0.01),
                Lon = -104.9903 - (i * 0.01),
                DistanceMiles = 1 + i,
                LastObservedAtUtc = DateTime.UtcNow.AddMinutes(-i),
                FreshnessMinutes = i,
                TempF = 68 + (i % 5),
                Humidity = 42 + i,
                DewPoint = 44 + (i % 4),
                FeelsLike = 69 + (i % 5),
                BaromRelIn = 29.9 + (i * 0.01),
                BaromAbsIn = 24.8 + (i * 0.01),
                WindSpeedMph = 5 + (i % 6),
                WindGustMph = 9 + (i % 8),
                WindDir = (i * 30) % 360,
                HourlyRainIn = i % 4 == 0 ? 0.01 : null,
                DailyRainIn = 0.02 * i,
                WeeklyRainIn = 0.05 * i,
                MonthlyRainIn = 0.12 * i,
                YearlyRainIn = 1.3 * i,
                SolarRadiation = i % 3 == 0 ? 250 + (i * 10) : null,
                Uv = i % 3 == 0 ? i % 9 : null,
            })
            .ToList();
}

/// <summary>
/// Web application factory for <see cref="DashboardCurrentNeighborsApiTests"/>.
/// </summary>
public sealed class DashboardCurrentNeighborsTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock preferences store.</summary>
    public Mock<IUserPreferencesStore> PrefStoreMock { get; } = new();

    /// <summary>Mock station store.</summary>
    public Mock<IUserStationStore> StationStoreMock { get; } = new();

    /// <summary>Mock neighbor discovery service.</summary>
    public Mock<INeighborDiscoveryService> DiscoveryServiceMock { get; } = new();

    /// <summary>Mock neighbor aggregation service.</summary>
    public Mock<INeighborAggregationService> AggregationServiceMock { get; } = new();

    /// <summary>Mock Ambient credential store.</summary>
    public Mock<IAmbientCredentialStore> CredentialStoreMock { get; } = new();

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration(config =>
            config.AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientWeather:ApplicationKey"] = "test-application-key",
                ["Testing:DisableRateLimiter"] = "true",
            }));
        builder.ConfigureTestServices(services =>
        {
            services
                .AddAuthentication(opts =>
                {
                    opts.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                    opts.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                })
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.SchemeName, _ => { });

            services.AddScoped<IUserPreferencesStore>(_ => PrefStoreMock.Object);
            services.AddScoped<IUserStationStore>(_ => StationStoreMock.Object);
            services.AddScoped<IAmbientCredentialStore>(_ => CredentialStoreMock.Object);
            services.AddScoped<INeighborDiscoveryService>(_ => DiscoveryServiceMock.Object);
            services.AddScoped<INeighborAggregationService>(_ => AggregationServiceMock.Object);
        });
    }

    /// <summary>Creates an HTTP client with the test user subject header.</summary>
    public HttpClient CreateAuthenticatedClient(string subject)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserSubjectHeader, subject);
        return client;
    }
}
