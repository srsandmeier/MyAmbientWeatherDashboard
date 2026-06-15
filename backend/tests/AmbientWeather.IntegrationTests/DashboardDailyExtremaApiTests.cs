using AmbientWeather.UnitTests.TestData;
using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Dashboard;
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
/// Integration tests for <c>GET /api/dashboard/daily-extremes</c>.
/// Mocks all external dependencies so tests verify HTTP plumbing, auth, and error mapping
/// without a database or Ambient API.
/// </summary>
public sealed class DashboardDailyExtremaApiTests : IClassFixture<DashboardDailyExtremaTestFactory>
{
    private const string UserSubject = "auth0|extrema-test-user";
    private static readonly string Mac = WeatherTestData.Mac;

    private readonly DashboardDailyExtremaTestFactory _factory;

    public DashboardDailyExtremaApiTests(DashboardDailyExtremaTestFactory factory)
    {
        _factory = factory;
        _factory.CredentialStoreMock.Reset();
        _factory.StationStoreMock.Reset();
        _factory.ReadingRepoMock.Reset();
        _factory.RestClientMock.Reset();
        _factory.PreferenceStoreMock.Reset();

        // Default prefs use local timezone (auto-detected from station.Tz).
        _factory.PreferenceStoreMock
            .Setup(s => s.GetOrCreateAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientWeather.Domain.Entities.UserPreferences { DailyExtremaTimezone = "local" });

        // Default REST fallback returns empty — individual tests override as needed.
        _factory.RestClientMock
            .Setup(r => r.GetDeviceHistoryAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DeviceHistoryResponseDto { Readings = [], TotalReadings = 0 });
    }

    private HttpClient AuthClient() => _factory.CreateAuthenticatedClient(UserSubject);

    [Fact]
    public async Task GetDailyExtremaShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/dashboard/daily-extremes");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetDailyExtremaShouldReturn428WhenNoCredentials()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/daily-extremes");
        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    [Fact]
    public async Task GetDailyExtremaShouldReturn428WhenNoDefaultStation()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("key", "appkey"));
        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/daily-extremes");
        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    [Fact]
    public async Task GetDailyExtremaShouldReturn200WithExtremaFromRepository()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("key", "appkey"));
        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = Mac, Name = WeatherTestData.StationName });
        _factory.ReadingRepoMock
            .Setup(r => r.GetDailyTempExtremaAsync(Mac, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((92.3, 68.1, 74.5, 65.0));

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/daily-extremes");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/json");

        var dto = await response.Content.ReadFromJsonAsync<DailyExtremaDto>();
        dto.ShouldNotBeNull();
        dto.DeviceId.ShouldBe(Mac);
        dto.DailyHighTempF.ShouldBe(92.3);
        dto.DailyLowTempF.ShouldBe(68.1);
        dto.DailyHighTempInF.ShouldBe(74.5);
        dto.DailyLowTempInF.ShouldBe(65.0);
    }

    [Fact]
    public async Task GetDailyExtremaShouldReturn200WithNullsWhenNoReadingsExist()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("key", "appkey"));
        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = Mac, Name = WeatherTestData.StationName });
        _factory.ReadingRepoMock
            .Setup(r => r.GetDailyTempExtremaAsync(Mac, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(((double?)null, (double?)null, (double?)null, (double?)null));

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/daily-extremes");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<DailyExtremaDto>();
        dto.ShouldNotBeNull();
        dto.DailyHighTempF.ShouldBeNull();
        dto.DailyLowTempF.ShouldBeNull();
    }
}

/// <summary>Web application factory for <see cref="DashboardDailyExtremaApiTests"/>.</summary>
public sealed class DashboardDailyExtremaTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock credential store.</summary>
    public Mock<IAmbientCredentialStore> CredentialStoreMock { get; } = new();

    /// <summary>Mock station store.</summary>
    public Mock<IUserStationStore> StationStoreMock { get; } = new();

    /// <summary>Mock weather reading repository.</summary>
    public Mock<IWeatherReadingRepository> ReadingRepoMock { get; } = new();

    /// <summary>Mock Ambient REST client (used by the REST fallback path).</summary>
    public Mock<IAmbientRestClient> RestClientMock { get; } = new();

    /// <summary>Mock user preferences store.</summary>
    public Mock<IUserPreferencesStore> PreferenceStoreMock { get; } = new();

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
            services.AddScoped<IWeatherReadingRepository>(_ => ReadingRepoMock.Object);
            services.AddScoped<IAmbientRestClient>(_ => RestClientMock.Object);
            services.AddScoped<IUserPreferencesStore>(_ => PreferenceStoreMock.Object);
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
