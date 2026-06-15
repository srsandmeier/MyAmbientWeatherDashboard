using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.DTOs.Neighbors;
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
/// Integration tests for <c>GET /api/neighbors/config</c> and <c>PUT /api/neighbors/config</c>.
/// </summary>
public sealed class NeighborsConfigApiTests : IClassFixture<NeighborsConfigTestFactory>
{
    private const string UserSubject = "auth0|neighbors-config-test";

    private readonly NeighborsConfigTestFactory _factory;

    public NeighborsConfigApiTests(NeighborsConfigTestFactory factory)
    {
        _factory = factory;
        _factory.PrefStoreMock.Reset();
        _factory.PrefStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences());
    }

    private HttpClient AuthClient() => _factory.CreateAuthenticatedClient(UserSubject);

    // -----------------------------------------------------------------------
    // Auth
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetConfigShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/neighbors/config");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task PutConfigShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.PutAsJsonAsync("/api/neighbors/config", ValidUpdateBody());
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // -----------------------------------------------------------------------
    // GET /api/neighbors/config — seeds defaults
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetConfigShouldReturn200WithDefaultsOnFirstAccess()
    {
        using var client = AuthClient();
        var response = await client.GetAsync("/api/neighbors/config");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/json");

        var dto = await response.Content.ReadFromJsonAsync<NeighborConfigDto>();
        dto.ShouldNotBeNull();
        dto.RadiusMiles.ShouldBe(25);
        dto.ComparisonRadiusMiles.ShouldBe(25);
        dto.MaxAgeMinutes.ShouldBe(30);
    }

    // -----------------------------------------------------------------------
    // PUT /api/neighbors/config — validation
    // -----------------------------------------------------------------------

    [Fact]
    public async Task PutConfigWithInvalidRadiusShouldReturn400()
    {
        _factory.PrefStoreMock
            .Setup(s => s.SaveAsync(It.IsAny<UserPreferences>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        using var client = AuthClient();
        var response = await client.PutAsJsonAsync("/api/neighbors/config",
            ValidUpdateBody() with { RadiusMiles = 200 });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PutConfigWithValidBodyShouldReturn200()
    {
        _factory.PrefStoreMock
            .Setup(s => s.SaveAsync(It.IsAny<UserPreferences>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        using var client = AuthClient();
        var response = await client.PutAsJsonAsync("/api/neighbors/config", ValidUpdateBody());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    private static NeighborUpdateRequestBody ValidUpdateBody() => new(
        IsEnabled: false,
        RadiusMiles: 20,
        ComparisonRadiusMiles: 12.5,
        MaxAgeMinutes: 30,
        MinStations: 3,
        EnabledProviders: ["WeatherGov"],
        RefreshIntervalMinutes: 15);
}

/// <summary>PUT /api/neighbors/config request body — mirrors <c>UpdateNeighborConfigCommand</c>.</summary>
internal sealed record NeighborUpdateRequestBody(
    bool IsEnabled,
    double RadiusMiles,
    double? ComparisonRadiusMiles,
    int MaxAgeMinutes,
    int MinStations,
    IReadOnlyList<string> EnabledProviders,
    int RefreshIntervalMinutes);

/// <summary>
/// Web application factory for neighbor config tests.
/// </summary>
public sealed class NeighborsConfigTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock user preferences store.</summary>
    public Mock<IUserPreferencesStore> PrefStoreMock { get; } = new();

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
