using AmbientWeather.UnitTests.TestData;
using System.Net;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.IntegrationTests.Auth;
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
/// Integration tests for <c>GET /api/dashboard/current</c>.
/// Mocks <see cref="IAmbientCredentialStore"/>, <see cref="IUserStationStore"/>,
/// <see cref="ILatestReadingCache"/>, and <see cref="IAmbientRestClient"/> so tests verify
/// HTTP plumbing, auth enforcement, and error-code mapping without a running database.
/// </summary>
public sealed class DashboardCurrentApiTests : IClassFixture<DashboardCurrentTestFactory>
{
    private const string UserSubject = "auth0|dashboard-test-user";

    private readonly DashboardCurrentTestFactory _factory;

    public DashboardCurrentApiTests(DashboardCurrentTestFactory factory)
    {
        _factory = factory;
        _factory.CredentialStoreMock.Reset();
        _factory.StationStoreMock.Reset();
        _factory.CacheMock.Reset();
        _factory.RestClientMock.Reset();
    }

    private HttpClient AuthClient() => _factory.CreateAuthenticatedClient(UserSubject);

    // -----------------------------------------------------------------------
    // Auth
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetCurrentShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/dashboard/current");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // -----------------------------------------------------------------------
    // 428 — credentials or station not configured
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetCurrentShouldReturn428WhenNoCredentials()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/current");

        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    [Fact]
    public async Task GetCurrentShouldReturn428WhenNoDefaultStation()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("key", "appkey"));

        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/current");

        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    // -----------------------------------------------------------------------
    // 200 — cache hit
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetCurrentShouldReturn200WithCachedReading()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("key", "appkey"));

        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = WeatherTestData.Mac, Name = WeatherTestData.StationName });

        _factory.CacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), WeatherTestData.Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CurrentReadingDto
            {
                DeviceId = WeatherTestData.Mac,
                DeviceName = WeatherTestData.StationName,
                TimestampUtc = DateTime.UtcNow,
                ReceivedAtUtc = DateTime.UtcNow,
                TempF = 71.0,
            });

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/current");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/json");
    }

    // -----------------------------------------------------------------------
    // 200 — REST fallback on cache miss
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetCurrentShouldReturn200ViRestFallbackOnCacheMiss()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("key", "appkey"));

        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = WeatherTestData.Mac, Name = WeatherTestData.StationName });

        _factory.CacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), WeatherTestData.Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        _factory.RestClientMock
            .Setup(r => r.GetDevicesAsync("key", "appkey", It.IsAny<CancellationToken>()))
            .ReturnsAsync([new DeviceDto
            {
                MacAddress = WeatherTestData.Mac,
                Info = new DeviceInfoDto { Name = WeatherTestData.StationName },
                LastData = new DeviceDataDto { DateUtc = 1_700_000_000_000L, TempF = 68.5 },
            }]);

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/current");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}

/// <summary>
/// Web application factory for <see cref="DashboardCurrentApiTests"/>.
/// Replaces all external dependencies with mocks so tests do not need a database or Ambient API.
/// </summary>
public sealed class DashboardCurrentTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock credential store.</summary>
    public Mock<IAmbientCredentialStore> CredentialStoreMock { get; } = new();

    /// <summary>Mock station store.</summary>
    public Mock<IUserStationStore> StationStoreMock { get; } = new();

    /// <summary>Mock latest-reading cache.</summary>
    public Mock<ILatestReadingCache> CacheMock { get; } = new();

    /// <summary>Mock Ambient REST client.</summary>
    public Mock<IAmbientRestClient> RestClientMock { get; } = new();

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

            services.AddScoped<IAmbientCredentialStore>(_ => CredentialStoreMock.Object);
            services.AddScoped<IUserStationStore>(_ => StationStoreMock.Object);
            services.AddSingleton<ILatestReadingCache>(_ => CacheMock.Object);
            services.AddScoped<IAmbientRestClient>(_ => RestClientMock.Object);
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
