using AmbientWeather.UnitTests.TestData;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Application.Features.Dashboard.Commands;
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
/// Integration tests for <c>GET /api/dashboard/layout</c> and <c>PUT /api/dashboard/layout</c>.
/// Mocks <see cref="IDashboardLayoutStore"/> and <see cref="IUserStationStore"/> so tests
/// verify HTTP plumbing, auth, validation pipeline, and error mapping without a database.
/// </summary>
public sealed class DashboardLayoutApiTests : IClassFixture<DashboardLayoutTestFactory>
{
    private const string UserSubject = "auth0|layout-test-user";
    private static readonly string Mac = WeatherTestData.Mac;

    private static readonly JsonSerializerOptions CaseInsensitive = new() { PropertyNameCaseInsensitive = true };
    private static readonly JsonSerializerOptions CamelCase = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly DashboardLayoutTestFactory _factory;

    public DashboardLayoutApiTests(DashboardLayoutTestFactory factory)
    {
        _factory = factory;
        _factory.LayoutStoreMock.Reset();
        _factory.StationStoreMock.Reset();
    }

    private HttpClient AuthClient() => _factory.CreateAuthenticatedClient(UserSubject);

    // ── GET /api/dashboard/layout ─────────────────────────────────────────────

    [Fact]
    public async Task GetLayoutShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/dashboard/layout");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetLayoutShouldReturn200WithExistingActiveLayout()
    {
        var layoutId = Guid.NewGuid();
        var tiles = new List<DashboardTileDto>
        {
            new() { I = "status", X = 0, Y = 0, W = 2, H = 3, Type = "status" },
        };
        var layoutJson = JsonSerializer.Serialize(tiles, CamelCase);

        _factory.LayoutStoreMock
            .Setup(s => s.GetActiveAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = layoutId,
                Name = "Default",
                IsActive = true,
                LayoutJson = layoutJson,
                UpdatedAtUtc = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            });

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/layout");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/json");

        var dto = await response.Content.ReadFromJsonAsync<DashboardLayoutDto>(CaseInsensitive);
        dto.ShouldNotBeNull();
        dto!.Id.ShouldBe(layoutId);
        dto.LayoutMode.ShouldBe("default");
        dto.Tiles.Count.ShouldBe(1);
        dto.Tiles[0].Type.ShouldBe("status");
    }

    [Fact]
    public async Task GetLayoutShouldReturn200WithSeededDefaultWhenNoneExists()
    {
        _factory.LayoutStoreMock
            .Setup(s => s.GetActiveAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((DashboardLayout?)null);

        _factory.StationStoreMock
            .Setup(s => s.GetDefaultStationAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = Mac, Name = WeatherTestData.StationName });

        var seedId = Guid.NewGuid();
        _factory.LayoutStoreMock
            .Setup(s => s.UpsertActiveAsync(UserSubject, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = seedId,
                Name = "Default",
                IsActive = true,
                LayoutJson = "[]",
                UpdatedAtUtc = DateTime.UtcNow,
            });

        using var client = AuthClient();
        var response = await client.GetAsync("/api/dashboard/layout");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<DashboardLayoutDto>(CaseInsensitive);
        dto.ShouldNotBeNull();
        dto!.Id.ShouldBe(seedId);
        dto.Tiles.ShouldContain(t => t.Type == "rainfall");
    }

    // ── PUT /api/dashboard/layout ─────────────────────────────────────────────

    [Fact]
    public async Task PutLayoutShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.PutAsJsonAsync("/api/dashboard/layout",
            new SaveDashboardLayoutCommand([]));
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task PutLayoutShouldReturn200WithValidTiles()
    {
        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationsAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync([new WeatherStation { MacAddress = Mac }]);

        var savedId = Guid.NewGuid();
        _factory.LayoutStoreMock
            .Setup(s => s.UpsertActiveAsync(UserSubject, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = savedId,
                Name = "Default",
                IsActive = true,
                LayoutJson = "[]",
                UpdatedAtUtc = DateTime.UtcNow,
            });

        var tiles = new List<DashboardTileDto>
        {
            new() { I = "status", X = 0, Y = 0, W = 2, H = 3, Type = "status" },
            new() { I = $"outdoor_temp-{Mac}", X = 2, Y = 0, W = 2, H = 3, Type = "metric", MetricKey = "outdoor_temp", DeviceId = Mac },
        };

        using var client = AuthClient();
        var response = await client.PutAsJsonAsync("/api/dashboard/layout",
            new SaveDashboardLayoutCommand(tiles));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<DashboardLayoutDto>(CaseInsensitive);
        dto.ShouldNotBeNull();
        dto!.Tiles.Count.ShouldBe(2);
    }

    [Fact]
    public async Task PutLayoutShouldReturn200WithValidCustomLayout()
    {
        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationsAsync(UserSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync([new WeatherStation { MacAddress = Mac }]);

        var savedId = Guid.NewGuid();
        _factory.LayoutStoreMock
            .Setup(s => s.UpsertActiveAsync(UserSubject, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = savedId,
                Name = "Default",
                IsActive = true,
                LayoutJson = "[]",
                UpdatedAtUtc = DateTime.UtcNow,
            });

        var command = new SaveDashboardLayoutCommand
        {
            LayoutMode = "custom",
            CustomItems =
            [
                new()
                {
                    Id = "block-1",
                    Type = "metric-block",
                    Name = "Comfort",
                    Size = "3x2",
                    DisplayMode = "fill",
                    Metrics =
                    [
                        new() { StationId = Mac, MetricKey = "outdoor_temp" },
                    ],
                },
                new() { Id = "divider-1", Type = "divider", Size = "3x1" },
            ],
        };

        using var client = AuthClient();
        var response = await client.PutAsJsonAsync("/api/dashboard/layout", command);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<DashboardLayoutDto>(CaseInsensitive);
        dto.ShouldNotBeNull();
        dto!.LayoutMode.ShouldBe("custom");
        dto.CustomItems.Count.ShouldBe(2);
    }

    [Fact]
    public async Task PutLayoutShouldReturn400WhenTileCountExceedsLimit()
    {
        var tiles = Enumerable.Range(0, 21)
            .Select(i => new DashboardTileDto { I = $"t{i}", X = 0, Y = i, W = 2, H = 1, Type = "status" })
            .ToList();

        using var client = AuthClient();
        var response = await client.PutAsJsonAsync("/api/dashboard/layout",
            new SaveDashboardLayoutCommand(tiles));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PutLayoutShouldReturn400WhenMetricKeyIsInvalid()
    {
        var tiles = new List<DashboardTileDto>
        {
            new() { I = "m", X = 0, Y = 0, W = 2, H = 3, Type = "metric", MetricKey = "not_a_real_metric", DeviceId = Mac },
        };

        using var client = AuthClient();
        var response = await client.PutAsJsonAsync("/api/dashboard/layout",
            new SaveDashboardLayoutCommand(tiles));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PutLayoutShouldReturn200WhenDeviceIdIsNotInOwnedStations()
    {
        // Layout is display configuration; unknown station IDs (e.g. runtime mock stations)
        // are allowed — data is scoped to the user at read time, not at save time.
        _factory.LayoutStoreMock
            .Setup(s => s.UpsertActiveAsync(UserSubject, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = Guid.NewGuid(),
                Name = "Default",
                IsActive = true,
                LayoutJson = "{}",
                UpdatedAtUtc = DateTime.UtcNow,
            });

        var tiles = new List<DashboardTileDto>
        {
            new() { I = $"outdoor_temp-{Mac}", X = 0, Y = 0, W = 2, H = 3, Type = "metric", MetricKey = "outdoor_temp", DeviceId = Mac },
        };

        using var client = AuthClient();
        var response = await client.PutAsJsonAsync("/api/dashboard/layout",
            new SaveDashboardLayoutCommand(tiles));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}

/// <summary>Web application factory for <see cref="DashboardLayoutApiTests"/>.</summary>
public sealed class DashboardLayoutTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock dashboard layout store.</summary>
    public Mock<IDashboardLayoutStore> LayoutStoreMock { get; } = new();

    /// <summary>Mock station store.</summary>
    public Mock<IUserStationStore> StationStoreMock { get; } = new();

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

            services.AddScoped<IDashboardLayoutStore>(_ => LayoutStoreMock.Object);
            services.AddScoped<IUserStationStore>(_ => StationStoreMock.Object);
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
