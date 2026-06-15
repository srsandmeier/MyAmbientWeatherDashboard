using AmbientWeather.UnitTests.TestData;
using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.DTOs.Metrics;
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

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Integration tests for GET /api/metrics/{metricKey}/history.
/// </summary>
public class MetricHistoryApiTests : IClassFixture<MetricsTestFactory>
{
    private const string UserSubject = "auth0|metrics-user-a";
    private const string OtherSubject = "auth0|metrics-user-b";
    private static readonly string ValidMac = WeatherTestData.Mac;
    private const string OtherUserMac = "112233445566";

    private static readonly WeatherStation DefaultStation = new()
    {
        Id = Guid.NewGuid(),
        MacAddress = ValidMac,
        Name = WeatherTestData.StationName,
        Nickname = "Back",
        IsPrimary = true,
    };

    private static readonly AmbientCredentials ValidCredentials =
        new("valid-api-key", "valid-app-key");

    private static readonly MetricHistoryResponseDto SampleResponse = new()
    {
        MetricKey = "outdoor_temp",
        DeviceId = ValidMac,
        DeviceName = "Back",
        Range = "24h",
        FromUtc = DateTime.UtcNow.AddHours(-24),
        ToUtc = DateTime.UtcNow,
        Granularity = "raw",
        Unit = "F",
        Points = [new MetricHistoryPointDto { TimestampUtc = DateTime.UtcNow.AddHours(-1), Value = 72.4 }],
        Warnings = [],
    };

    private readonly MetricsTestFactory _factory;

    public MetricHistoryApiTests(MetricsTestFactory factory)
    {
        _factory = factory;
        _factory.CredentialStoreMock.Reset();
        _factory.StationStoreMock.Reset();
        _factory.HistoryServiceMock.Reset();
        _factory.ResetPreferencesMock();
    }

    // -----------------------------------------------------------------------
    // Authentication (401) — uses the base TestApplicationFactory
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetMetricHistoryShouldReturn401WhenNoToken()
    {
        using var unauthFactory = new TestApplicationFactory();
        using var client = unauthFactory.CreateClient();

        var response = await client.GetAsync("/api/metrics/outdoor_temp/history?range=24h");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // -----------------------------------------------------------------------
    // Validation (400)
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("/api/metrics/unknown_metric/history?range=24h")]
    [InlineData("/api/metrics/outdoor_temp/history?range=bad_range")]
    [InlineData("/api/metrics/outdoor_temp/history?range=custom")]
    [InlineData("/api/metrics/outdoor_temp/history?range=date")]
    [InlineData("/api/metrics/outdoor_temp/history?range=date&date=05-29-2026")]
    [InlineData("/api/metrics/outdoor_temp/history?range=24h&source=neighbours")]
    [InlineData("/api/metrics/outdoor_temp/history?range=24h&deviceId=not-a-mac")]
    public async Task GetMetricHistoryShouldReturn400ForInvalidParams(string url)
    {
        var response = await _factory.CreateAuthenticatedClient(UserSubject)
            .GetAsync(url);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    // -----------------------------------------------------------------------
    // 428 — credentials not configured
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetMetricHistoryShouldReturn428WhenCredentialsMissing()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        var response = await _factory.CreateAuthenticatedClient(UserSubject)
            .GetAsync("/api/metrics/outdoor_temp/history?range=24h");

        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    // -----------------------------------------------------------------------
    // 428 — no default station configured
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetMetricHistoryShouldReturn428WhenNoDefaultStation()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ValidCredentials);
        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        var response = await _factory.CreateAuthenticatedClient(UserSubject)
            .GetAsync("/api/metrics/outdoor_temp/history?range=24h");

        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    // -----------------------------------------------------------------------
    // 404 — explicit deviceId not owned by the requesting user
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetMetricHistoryShouldReturn404WhenExplicitDeviceNotOwnedByUser()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ValidCredentials);
        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationByMacAsync(UserSubject, OtherUserMac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        var response = await _factory.CreateAuthenticatedClient(UserSubject)
            .GetAsync($"/api/metrics/outdoor_temp/history?range=24h&deviceId={OtherUserMac}");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    // -----------------------------------------------------------------------
    // 200 — success path using default station
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetMetricHistoryShouldReturn200WithSeriesWhenDefaultStationAndCredentialsExist()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ValidCredentials);
        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(DefaultStation);
        _factory.HistoryServiceMock
            .Setup(s => s.GetHistoryAsync(
                ValidMac, It.IsAny<string?>(), "outdoor_temp",
                It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<string>(), "24h",
                UserSubject,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(SampleResponse);

        var response = await _factory.CreateAuthenticatedClient(UserSubject)
            .GetAsync("/api/metrics/outdoor_temp/history?range=24h");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<MetricHistoryResponseDto>();
        body.ShouldNotBeNull();
        body!.MetricKey.ShouldBe("outdoor_temp");
        body.DeviceId.ShouldBe(ValidMac);
        body.Points.Count.ShouldBe(1);
        body.Points[0].Value.ShouldBe(72.4);
        body.Warnings.ShouldBeEmpty();
    }

    // -----------------------------------------------------------------------
    // 200 — success path using explicit owned deviceId
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetMetricHistoryShouldReturn200WhenExplicitOwnedDeviceId()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ValidCredentials);
        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationByMacAsync(UserSubject, ValidMac, It.IsAny<CancellationToken>()))
            .ReturnsAsync(DefaultStation);
        _factory.HistoryServiceMock
            .Setup(s => s.GetHistoryAsync(
                ValidMac, It.IsAny<string?>(), "wind_speed",
                It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<string>(), "7d",
                UserSubject,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(SampleResponse with { MetricKey = "wind_speed", Unit = "mph" });

        var response = await _factory.CreateAuthenticatedClient(UserSubject)
            .GetAsync($"/api/metrics/wind_speed/history?range=7d&deviceId={ValidMac}");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<MetricHistoryResponseDto>();
        body!.MetricKey.ShouldBe("wind_speed");
    }
}

/// <summary>
/// Web application factory for metrics integration tests.
/// Registers mocks for <see cref="IAmbientCredentialStore"/>, <see cref="IUserStationStore"/>,
/// and <see cref="IAmbientHistoryService"/> so tests can run without a real database or Ambient API.
/// </summary>
public sealed class MetricsTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock for <see cref="IAmbientCredentialStore"/>.</summary>
    public Mock<IAmbientCredentialStore> CredentialStoreMock { get; } = new();

    /// <summary>Mock for <see cref="IUserStationStore"/>.</summary>
    public Mock<IUserStationStore> StationStoreMock { get; } = new();

    /// <summary>Mock for <see cref="IAmbientHistoryService"/>.</summary>
    public Mock<IAmbientHistoryService> HistoryServiceMock { get; } = new();

    /// <summary>Mock for <see cref="IUserPreferencesStore"/>; returns UTC defaults.</summary>
    public Mock<IUserPreferencesStore> PreferencesStoreMock { get; } = BuildDefaultPreferencesMock();

    /// <summary>
    /// Creates an authenticated <see cref="HttpClient"/> with the test user subject header set.
    /// </summary>
    public HttpClient CreateAuthenticatedClient(string subject)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserSubjectHeader, subject);
        return client;
    }

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
                .AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                    options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                })
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.SchemeName, _ => { });

            services.AddScoped<IAmbientCredentialStore>(_ => CredentialStoreMock.Object);
            services.AddScoped<IUserStationStore>(_ => StationStoreMock.Object);
            services.AddScoped<IAmbientHistoryService>(_ => HistoryServiceMock.Object);
            services.AddScoped<IUserPreferencesStore>(_ => PreferencesStoreMock.Object);
        });
    }

    /// <summary>Resets the preferences mock and re-applies the default UTC setup.</summary>
    public void ResetPreferencesMock()
    {
        PreferencesStoreMock.Reset();
        PreferencesStoreMock
            .Setup(s => s.GetOrCreateAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences { DailyExtremaTimezone = "utc" });
    }

    private static Mock<IUserPreferencesStore> BuildDefaultPreferencesMock()
    {
        var mock = new Mock<IUserPreferencesStore>();
        mock.Setup(s => s.GetOrCreateAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences { DailyExtremaTimezone = "utc" });
        return mock;
    }
}
