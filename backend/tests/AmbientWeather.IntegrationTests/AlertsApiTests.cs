using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.DTOs.Alerts;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.IntegrationTests.Auth;
using Bogus;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Shouldly;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Integration tests for <c>GET /api/alerts/active</c>.
/// </summary>
public sealed class AlertsApiTests : IClassFixture<AlertsTestFactory>
{
    private const string UserSubject = "auth0|alerts-test-user";
    private static readonly Faker F = new();

    private readonly AlertsTestFactory _factory;

    public AlertsApiTests(AlertsTestFactory factory)
    {
        _factory = factory;
        _factory.StationStoreMock.Reset();
        _factory.AlertServiceMock.Reset();
    }

    [Fact]
    public async Task GetActiveAlertsShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/alerts/active");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetActiveAlertsShouldReturnEmptyWhenStationHasNoCoordinates()
    {
        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = F.Random.Hexadecimal(12, string.Empty) });

        using var client = _factory.CreateAuthenticatedClient(UserSubject);
        var response = await client.GetAsync("/api/alerts/active");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var alerts = await response.Content.ReadFromJsonAsync<List<WeatherAlertDto>>();
        alerts.ShouldNotBeNull();
        alerts.ShouldBeEmpty();
    }

    [Fact]
    public async Task GetActiveAlertsShouldReturnAlertsForCurrentUserDefaultStation()
    {
        var station = new WeatherStation
        {
            MacAddress = F.Random.Hexadecimal(12, string.Empty),
            Latitude = F.Random.Double(18, 71),
            Longitude = F.Random.Double(-179, -61),
        };
        var alert = new WeatherAlertDto
        {
            Id = F.Random.AlphaNumeric(12),
            Event = $"Generated event {F.Random.AlphaNumeric(4)}",
        };
        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(station);
        _factory.AlertServiceMock
            .Setup(s => s.GetActiveAlertsAsync(
                It.IsAny<string>(),
                station.Latitude.Value,
                station.Longitude.Value,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([alert]);

        using var client = _factory.CreateAuthenticatedClient(UserSubject);
        var response = await client.GetAsync("/api/alerts/active");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var alerts = await response.Content.ReadFromJsonAsync<List<WeatherAlertDto>>();
        alerts.ShouldNotBeNull();
        alerts.Count.ShouldBe(1);
        alerts[0].Id.ShouldBe(alert.Id);
    }

    [Fact]
    public async Task GetActiveAlertsShouldReturnAlertsForSelectedArea()
    {
        var areaCode = F.Address.StateAbbr();
        var alert = new WeatherAlertDto
        {
            Id = F.Random.AlphaNumeric(12),
            Event = $"Generated event {F.Random.AlphaNumeric(4)}",
        };
        _factory.AlertServiceMock
            .Setup(s => s.GetActiveAlertsForAreaAsync(
                It.IsAny<string>(),
                areaCode,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([alert]);

        using var client = _factory.CreateAuthenticatedClient(UserSubject);
        var response = await client.GetAsync($"/api/alerts/active?area={areaCode}");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var alerts = await response.Content.ReadFromJsonAsync<List<WeatherAlertDto>>();
        alerts.ShouldNotBeNull();
        alerts.Count.ShouldBe(1);
        alerts[0].Id.ShouldBe(alert.Id);
        _factory.StationStoreMock.Verify(
            s => s.GetDefaultStationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}

/// <summary>
/// Web application factory for alerts tests.
/// </summary>
public sealed class AlertsTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock station store.</summary>
    public Mock<IUserStationStore> StationStoreMock { get; } = new();

    /// <summary>Mock alert service.</summary>
    public Mock<IWeatherAlertService> AlertServiceMock { get; } = new();

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
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

            services.AddScoped<IUserStationStore>(_ => StationStoreMock.Object);
            services.AddScoped<IWeatherAlertService>(_ => AlertServiceMock.Object);
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
