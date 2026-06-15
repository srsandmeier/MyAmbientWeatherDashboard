using AmbientWeather.UnitTests.TestData;
using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Domain.Neighbors;
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
using Xunit;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Integration tests for <c>POST /api/neighbors/refresh</c>.
/// </summary>
public sealed class NeighborsRefreshApiTests : IClassFixture<NeighborsRefreshTestFactory>
{
    private const string UserSubject = "auth0|neighbors-refresh-test";
    private static readonly Faker F = new();

    private readonly NeighborsRefreshTestFactory _factory;

    public NeighborsRefreshApiTests(NeighborsRefreshTestFactory factory)
    {
        _factory = factory;
        _factory.PrefStoreMock.Reset();
        _factory.StationStoreMock.Reset();
        _factory.DiscoveryServiceMock.Reset();
        _factory.GeocodingServiceMock.Reset();
        _factory.CredentialStoreMock.Reset();
    }

    private HttpClient AuthClient() => _factory.CreateAuthenticatedClient(UserSubject);

    // -----------------------------------------------------------------------
    // Auth
    // -----------------------------------------------------------------------

    [Fact]
    public async Task RefreshShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.PostAsync("/api/neighbors/refresh", null);
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // -----------------------------------------------------------------------
    // 200 — returns empty list when feature disabled or no coordinates
    // -----------------------------------------------------------------------

    [Fact]
    public async Task RefreshShouldReturn200EmptyListWhenFeatureDisabled()
    {
        _factory.PrefStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences
            {
                NeighborConfigJson =
                    """{"isEnabled":false,"radiusMiles":25,"maxAgeMinutes":30,"minStations":3,"enabledProviders":["WeatherGov"],"refreshIntervalMinutes":15}""",
            });

        using var client = AuthClient();
        var response = await client.PostAsync("/api/neighbors/refresh", null);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var stations = await response.Content.ReadFromJsonAsync<List<NeighborStationDto>>();
        stations.ShouldNotBeNull();
        stations.Count.ShouldBe(0);
    }

    // -----------------------------------------------------------------------
    // 200 — returns discovered station list when enabled + coords present
    // -----------------------------------------------------------------------

    [Fact]
    public async Task RefreshShouldReturn200WithStationListWhenEnabled()
    {
        var stationName = $"Generated station {F.Random.AlphaNumeric(4)}";
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
                Name = "Test Station",
                Latitude = F.Random.Double(25, 49),
                Longitude = F.Random.Double(-124, -66),
            });

        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("api-key", "application-key"));

        var discoveredStation = new NeighborStation
        {
            Provider = "WeatherGov",
            SourceId = $"generated-{F.Random.AlphaNumeric(8)}",
            Name = stationName,
            Lat = F.Random.Double(25, 49),
            Lon = F.Random.Double(-124, -66),
            DistanceMiles = 8.5,
            TempF = 72.0,
            LastObservedAtUtc = DateTime.UtcNow.AddMinutes(-10),
        };

        _factory.DiscoveryServiceMock
            .Setup(d => d.InvalidateCacheAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _factory.DiscoveryServiceMock
            .Setup(d => d.GetOrDiscoverAsync(It.IsAny<string>(), It.IsAny<NeighborConfig>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([discoveredStation]);

        using var client = AuthClient();
        var response = await client.PostAsync("/api/neighbors/refresh", null);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var stations = await response.Content.ReadFromJsonAsync<List<NeighborStationDto>>();
        stations.ShouldNotBeNull();
        stations.Count.ShouldBe(1);
        stations[0].Name.ShouldBe(stationName);
    }

    [Fact]
    public async Task RefreshShouldUseDiscoveryLocationWhenOwnedStationCoordinatesAreMissing()
    {
        var query = $"Generated City {F.Random.AlphaNumeric(4)}, KS";
        var displayName = $"{query}, United States";
        _factory.PrefStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences
            {
                NeighborConfigJson =
                    $$"""{"isEnabled":true,"radiusMiles":25,"maxAgeMinutes":30,"minStations":3,"enabledProviders":["WeatherGov"],"refreshIntervalMinutes":15,"discoveryLocationQuery":"{{query}}"}""",
            });

        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        _factory.GeocodingServiceMock
            .Setup(g => g.GeocodeAsync(query, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GeocodedLocation(39.0483, -95.6780, displayName));

        NeighborConfig? discoveredWithConfig = null;
        _factory.DiscoveryServiceMock
            .Setup(d => d.InvalidateCacheAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _factory.DiscoveryServiceMock
            .Setup(d => d.GetOrDiscoverAsync(It.IsAny<string>(), It.IsAny<NeighborConfig>(), It.IsAny<CancellationToken>()))
            .Callback<string, NeighborConfig, CancellationToken>((_, config, _) => { discoveredWithConfig = config; })
            .ReturnsAsync([]);

        using var client = AuthClient();
        var response = await client.PostAsync("/api/neighbors/refresh", null);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        discoveredWithConfig.ShouldNotBeNull();
        discoveredWithConfig.UserLatitude.ShouldBe(39.0483);
        discoveredWithConfig.UserLongitude.ShouldBe(-95.6780);
        discoveredWithConfig.UserLocationLabel.ShouldBe(displayName);
    }

    [Fact]
    public async Task RefreshShouldPreferOwnedStationCoordinatesOverDiscoveryLocationQuery()
    {
        var query = $"Generated Area {F.Random.AlphaNumeric(4)}, KS";
        _factory.PrefStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences
            {
                NeighborConfigJson =
                    $$"""{"isEnabled":true,"radiusMiles":25,"maxAgeMinutes":30,"minStations":3,"enabledProviders":["WeatherGov"],"refreshIntervalMinutes":15,"discoveryLocationQuery":"{{query}}"}""",
            });

        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation
            {
                MacAddress = WeatherTestData.Mac,
                Name = "Owned Station",
                Latitude = 41.0000,
                Longitude = -101.0000,
            });

        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("api-key", "application-key"));

        NeighborConfig? discoveredWithConfig = null;
        _factory.DiscoveryServiceMock
            .Setup(d => d.InvalidateCacheAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _factory.DiscoveryServiceMock
            .Setup(d => d.GetOrDiscoverAsync(It.IsAny<string>(), It.IsAny<NeighborConfig>(), It.IsAny<CancellationToken>()))
            .Callback<string, NeighborConfig, CancellationToken>((_, config, _) => { discoveredWithConfig = config; })
            .ReturnsAsync([]);

        using var client = AuthClient();
        var response = await client.PostAsync("/api/neighbors/refresh", null);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        discoveredWithConfig.ShouldNotBeNull();
        // GPS coords from the owned station take priority over the text discovery query,
        // matching the same priority used by GetNeighborCurrentReadingQueryHandler.
        discoveredWithConfig.UserLatitude.ShouldBe(41.0000);
        discoveredWithConfig.UserLongitude.ShouldBe(-101.0000);
    }

    [Fact]
    public async Task RefreshShouldRequireDiscoveryLocationWhenCredentialsAreMissingEvenIfCachedStationCoordinatesExist()
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
                Name = "Cached station",
                Latitude = F.Random.Double(25, 49),
                Longitude = F.Random.Double(-124, -66),
            });

        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        using var client = AuthClient();
        var response = await client.PostAsync("/api/neighbors/refresh", null);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var stations = await response.Content.ReadFromJsonAsync<List<NeighborStationDto>>();
        stations.ShouldNotBeNull();
        stations.Count.ShouldBe(0);
        _factory.DiscoveryServiceMock.Verify(
            d => d.GetOrDiscoverAsync(It.IsAny<string>(), It.IsAny<NeighborConfig>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}

/// <summary>
/// Web application factory for neighbor refresh tests.
/// </summary>
public sealed class NeighborsRefreshTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock preferences store.</summary>
    public Mock<IUserPreferencesStore> PrefStoreMock { get; } = new();

    /// <summary>Mock station store.</summary>
    public Mock<IUserStationStore> StationStoreMock { get; } = new();

    /// <summary>Mock neighbor discovery service.</summary>
    public Mock<INeighborDiscoveryService> DiscoveryServiceMock { get; } = new();

    /// <summary>Mock location geocoding service.</summary>
    public Mock<ILocationGeocodingService> GeocodingServiceMock { get; } = new();

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
            services.AddScoped<INeighborDiscoveryService>(_ => DiscoveryServiceMock.Object);
            services.AddScoped<ILocationGeocodingService>(_ => GeocodingServiceMock.Object);
            services.AddScoped<IAmbientCredentialStore>(_ => CredentialStoreMock.Object);
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
