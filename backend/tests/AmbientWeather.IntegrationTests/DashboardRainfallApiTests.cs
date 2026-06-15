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
/// Integration tests for <c>GET /api/dashboard/rainfall</c>.
/// Mocks all external dependencies so tests verify HTTP plumbing, auth, and error mapping
/// without a database or Ambient API.
/// </summary>
public sealed class DashboardRainfallApiTests : IClassFixture<DashboardRainfallTestFactory>
{
    private const string UserSubject = "auth0|rainfall-test-user";

    private readonly DashboardRainfallTestFactory _factory;

    public DashboardRainfallApiTests(DashboardRainfallTestFactory factory)
    {
        _factory = factory;
        _factory.CredentialStoreMock.Reset();
        _factory.StationStoreMock.Reset();
        _factory.CacheMock.Reset();
        _factory.RestClientMock.Reset();
    }

    private HttpClient AuthClient() => _factory.CreateAuthenticatedClient(UserSubject);

    [Fact]
    public async Task GetRainfallShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/dashboard/rainfall");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetRainfallShouldReturn428WhenNoCredentials()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/rainfall");
        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    [Fact]
    public async Task GetRainfallShouldReturn428WhenNoDefaultStation()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("key", "appkey"));
        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/rainfall");
        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    [Fact]
    public async Task GetRainfallShouldReturn200WithCachedReading()
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
                DailyRainIn = 0.25,
            });

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/rainfall");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/json");
    }

    [Fact]
    public async Task GetRainfallShouldReturn200ViRestFallbackOnCacheMiss()
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
                LastData = new DeviceDataDto { DateUtc = 1_700_000_000_000L, DailyRainIn = 0.5 },
            }]);

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/rainfall");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}

/// <summary>Web application factory for <see cref="DashboardRainfallApiTests"/>.</summary>
public sealed class DashboardRainfallTestFactory : WebApplicationFactory<Program>
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

    /// <summary>Creates an HTTP client authenticated as the given subject.</summary>
    public HttpClient CreateAuthenticatedClient(string subject)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserSubjectHeader, subject);
        return client;
    }
}
