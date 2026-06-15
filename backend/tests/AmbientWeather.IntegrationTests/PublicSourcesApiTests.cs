using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.DTOs.Common;
using AmbientWeather.Application.DTOs.PublicSources;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Features.PublicSources;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.IntegrationTests.Auth;
using AmbientWeather.UnitTests.TestData;
using Bogus;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Shouldly;
using System.Collections.Generic;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Integration tests for <c>/api/public-sources</c>.
/// </summary>
public sealed class PublicSourcesApiTests : IClassFixture<PublicSourcesTestFactory>
{
    private const string UserASubject = "auth0|public-source-user-a";
    private const string UserBSubject = "auth0|public-source-user-b";
    private static readonly Faker F = new();

    private readonly PublicSourcesTestFactory _factory;

    public PublicSourcesApiTests(PublicSourcesTestFactory factory)
    {
        _factory = factory;
        _factory.SourceStoreMock.Reset();
        _factory.CurrentReadingServiceMock.Reset();
        _factory.DiscoveryServiceMock.Reset();
    }

    // ── Discover ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task DiscoverShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/public-sources/discover?q=generated");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DiscoverShouldReturn400WhenQueryIsMissing()
    {
        using var client = _factory.CreateAuthenticatedClient(UserASubject);
        var response = await client.GetAsync("/api/public-sources/discover");
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("invalid-query");
    }

    [Fact]
    public async Task DiscoverShouldReturn400WhenQueryIsTooLong()
    {
        var longQuery = new string('x', 129);
        using var client = _factory.CreateAuthenticatedClient(UserASubject);
        var response = await client.GetAsync($"/api/public-sources/discover?q={Uri.EscapeDataString(longQuery)}");
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("invalid-query");
    }

    [Fact]
    public async Task DiscoverShouldReturn200WithListFromService()
    {
        var discovered = new List<DiscoveredPublicSourceDto>
        {
            new()
            {
                Provider = "WeatherGov",
                SourceId = $"KGEN{F.Random.AlphaNumeric(3).ToUpperInvariant()}",
                DisplayLabel = $"Generated Station {F.Random.AlphaNumeric(4)}",
                Latitude = F.Address.Latitude(),
                Longitude = F.Address.Longitude(),
                Timezone = null,
            },
        };
        _factory.DiscoveryServiceMock
            .Setup(s => s.DiscoverAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(discovered);

        using var client = _factory.CreateAuthenticatedClient(UserASubject);
        var response = await client.GetAsync("/api/public-sources/discover?q=Generated+City+ST");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var list = await response.Content.ReadFromJsonAsync<List<DiscoveredPublicSourceDto>>();
        list.ShouldNotBeNull();
        list.Count.ShouldBe(1);
        list[0].Provider.ShouldBe("WeatherGov");
    }

    [Fact]
    public async Task DiscoverShouldReturn200WithEmptyListWhenServiceReturnsNothing()
    {
        _factory.DiscoveryServiceMock
            .Setup(s => s.DiscoverAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        using var client = _factory.CreateAuthenticatedClient(UserASubject);
        var response = await client.GetAsync("/api/public-sources/discover?q=Generated+Unknown+Place");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var list = await response.Content.ReadFromJsonAsync<List<DiscoveredPublicSourceDto>>();
        list.ShouldNotBeNull();
        list.ShouldBeEmpty();
    }

    // ── Existing CRUD ─────────────────────────────────────────────────────────

    [Fact]
    public async Task GetSourcesShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/public-sources");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetSourcesShouldReturnCurrentUserSources()
    {
        var source = CreateSource();
        _factory.SourceStoreMock
            .Setup(s => s.GetAllAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync([source]);
        _factory.SourceStoreMock
            .Setup(s => s.GetAllAsync(UserBSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        using var clientA = _factory.CreateAuthenticatedClient(UserASubject);
        using var clientB = _factory.CreateAuthenticatedClient(UserBSubject);

        var responseA = await clientA.GetAsync("/api/public-sources");
        var responseB = await clientB.GetAsync("/api/public-sources");

        responseA.StatusCode.ShouldBe(HttpStatusCode.OK);
        responseB.StatusCode.ShouldBe(HttpStatusCode.OK);
        var listA = await responseA.Content.ReadFromJsonAsync<List<PublicWeatherSourceDto>>();
        var listB = await responseB.Content.ReadFromJsonAsync<List<PublicWeatherSourceDto>>();
        listA.ShouldNotBeNull();
        listB.ShouldNotBeNull();
        listA.Count.ShouldBe(1);
        listB.ShouldBeEmpty();
    }

    [Fact]
    public async Task CreateSourceShouldReturn400WhenProviderIsInvalid()
    {
        using var client = _factory.CreateAuthenticatedClient(UserASubject);
        var response = await client.PostAsJsonAsync(
            "/api/public-sources",
            new
            {
                provider = "Unsupported",
                sourceId = WeatherTestData.SourceId,
                displayLabel = GeneratedLabel(),
                latitude = F.Address.Latitude(),
                longitude = F.Address.Longitude(),
                isEnabled = true,
            });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("validation-error");
    }

    [Fact]
    public async Task CreateSourceShouldReturn201AndSaveSource()
    {
        _factory.SourceStoreMock
            .Setup(s => s.AddAsync(
                UserASubject,
                It.IsAny<string?>(),
                It.IsAny<PublicWeatherSource>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((string _, string? _, PublicWeatherSource source, CancellationToken _) => source);

        using var client = _factory.CreateAuthenticatedClient(UserASubject);
        var response = await client.PostAsJsonAsync(
            "/api/public-sources",
            new
            {
                provider = PublicWeatherSourceProviders.WeatherGov,
                sourceId = WeatherTestData.SourceId,
                displayLabel = GeneratedLabel(),
                latitude = F.Address.Latitude(),
                longitude = F.Address.Longitude(),
                isEnabled = true,
            });

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        _factory.SourceStoreMock.Verify(
            s => s.AddAsync(
                UserASubject,
                It.IsAny<string?>(),
                It.Is<PublicWeatherSource>(source => source.Provider == PublicWeatherSourceProviders.WeatherGov),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task UpdateSourceShouldReturn404WhenSourceIsNotOwned()
    {
        _factory.SourceStoreMock
            .Setup(s => s.GetByIdAsync(UserASubject, It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((PublicWeatherSource?)null);

        using var client = _factory.CreateAuthenticatedClient(UserASubject);
        var response = await client.PutAsJsonAsync(
            $"/api/public-sources/{Guid.NewGuid()}",
            new { displayLabel = GeneratedLabel() });

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("public-source-not-found");
    }

    [Fact]
    public async Task UpdateSourceShouldReturn200AndSavePatch()
    {
        var source = CreateSource();
        _factory.SourceStoreMock
            .Setup(s => s.GetByIdAsync(UserASubject, source.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(source);
        _factory.SourceStoreMock
            .Setup(s => s.SaveAsync(source, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        using var client = _factory.CreateAuthenticatedClient(UserASubject);
        var label = GeneratedLabel();
        var response = await client.PutAsJsonAsync(
            $"/api/public-sources/{source.Id}",
            new { displayLabel = label, isEnabled = false });

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        source.DisplayLabel.ShouldBe(label);
        source.IsEnabled.ShouldBeFalse();
    }

    [Fact]
    public async Task DeleteSourceShouldReturn204ForOwnedSource()
    {
        var source = CreateSource();
        _factory.SourceStoreMock
            .Setup(s => s.GetByIdAsync(UserASubject, source.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(source);
        _factory.SourceStoreMock
            .Setup(s => s.DeleteAsync(source, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        using var client = _factory.CreateAuthenticatedClient(UserASubject);
        var response = await client.DeleteAsync($"/api/public-sources/{source.Id}");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task GetSourceCurrentShouldReturnCurrentReadingForOwnedSource()
    {
        var source = CreateSource();
        var reading = new CurrentReadingDto
        {
            DeviceId = $"public:{source.Id}",
            DeviceName = source.DisplayLabel,
            TimestampUtc = DateTime.UtcNow,
            ReceivedAtUtc = DateTime.UtcNow,
            Source = "public",
            TempF = F.Random.Double(10, 100),
        };
        _factory.SourceStoreMock
            .Setup(s => s.GetByIdAsync(UserASubject, source.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(source);
        _factory.CurrentReadingServiceMock
            .Setup(s => s.GetCurrentAsync(It.IsAny<string>(), source, It.IsAny<CancellationToken>()))
            .ReturnsAsync(reading);

        using var client = _factory.CreateAuthenticatedClient(UserASubject);
        var response = await client.GetAsync($"/api/public-sources/{source.Id}/current");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<CurrentReadingDto>();
        dto.ShouldNotBeNull();
        dto.DeviceId.ShouldBe(reading.DeviceId);
    }

    private static PublicWeatherSource CreateSource() => new()
    {
        Id = Guid.NewGuid(),
        Provider = PublicWeatherSourceProviders.OpenMeteo,
        SourceId = WeatherTestData.SourceId,
        DisplayLabel = GeneratedLabel(),
        Latitude = F.Address.Latitude(),
        Longitude = F.Address.Longitude(),
        IsEnabled = true,
    };

    private static string GeneratedLabel() => $"Generated source {F.Random.AlphaNumeric(4)}";
}

/// <summary>
/// <see cref="WebApplicationFactory{TEntryPoint}"/> for public source API tests.
/// </summary>
public sealed class PublicSourcesTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock for <see cref="IPublicWeatherSourceStore"/>.</summary>
    public Mock<IPublicWeatherSourceStore> SourceStoreMock { get; } = new();

    /// <summary>Mock for <see cref="IPublicSourceCurrentReadingService"/>.</summary>
    public Mock<IPublicSourceCurrentReadingService> CurrentReadingServiceMock { get; } = new();

    /// <summary>Mock for <see cref="IPublicSourceDiscoveryService"/>.</summary>
    public Mock<IPublicSourceDiscoveryService> DiscoveryServiceMock { get; } = new();

    /// <summary>
    /// Creates an authenticated <see cref="HttpClient"/> using test header injection.
    /// </summary>
    public HttpClient CreateAuthenticatedClient(string subject, string? email = null)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserSubjectHeader, subject);
        if (email != null)
            client.DefaultRequestHeaders.Add(TestAuthHandler.UserEmailHeader, email);
        return client;
    }

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
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

            services.AddScoped<IPublicWeatherSourceStore>(_ => SourceStoreMock.Object);
            services.AddScoped<IPublicSourceCurrentReadingService>(_ => CurrentReadingServiceMock.Object);
            services.AddScoped<IPublicSourceDiscoveryService>(_ => DiscoveryServiceMock.Object);
        });
    }
}
