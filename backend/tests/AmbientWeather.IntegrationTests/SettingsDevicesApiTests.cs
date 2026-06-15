using AmbientWeather.UnitTests.TestData;
using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Common;
using AmbientWeather.Application.DTOs.Settings;
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
/// Integration tests for <c>GET/POST/PUT /api/settings/devices</c>.
/// Mocks <see cref="IUserStationStore"/>, <see cref="IAmbientRestClient"/>, and
/// <see cref="IAmbientCredentialStore"/> so no database or live API is required.
/// </summary>
public sealed class SettingsDevicesApiTests : IClassFixture<SettingsDevicesTestFactory>
{
    private const string UserASubject = "auth0|device-test-user-a";
    private const string UserBSubject = "auth0|device-test-user-b";
    private const string ValidApiKey = "valid-api-key";
    private const string ValidAppKey = "valid-app-key";

    private static readonly WeatherStation StationA = new()
    {
        Id = Guid.NewGuid(),
        MacAddress = WeatherTestData.Mac,
        Name = WeatherTestData.StationName,
        Nickname = "Back",
        IsPrimary = true,
        DisplayOnDashboard = true,
        LastSyncAtUtc = new DateTime(2026, 5, 30, 0, 0, 0, DateTimeKind.Utc),
    };

    private static readonly DeviceDto DeviceFromAmbient = new()
    {
        MacAddress = WeatherTestData.ColonMac,
        Info = new DeviceInfoDto { Name = WeatherTestData.StationName },
        LastData = new DeviceDataDto { DateUtc = 0 },
    };

    private readonly SettingsDevicesTestFactory _factory;

    public SettingsDevicesApiTests(SettingsDevicesTestFactory factory)
    {
        _factory = factory;
        _factory.StationStoreMock.Reset();
        _factory.CredentialStoreMock.Reset();
        _factory.AmbientRestClientMock.Reset();
    }

    // -------------------------------------------------------------------------
    // GET /api/settings/devices
    // -------------------------------------------------------------------------

    [Fact]
    public async Task GetDevicesShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/settings/devices");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetDevicesShouldReturnEmptyListWhenNoStationsSynced()
    {
        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationsAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.GetAsync("/api/settings/devices");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var list = await response.Content.ReadFromJsonAsync<List<SettingsDeviceDto>>();
        list.ShouldNotBeNull();
        list.ShouldBeEmpty();
    }

    [Fact]
    public async Task GetDevicesShouldReturnMappedStations()
    {
        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationsAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync([StationA]);

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.GetAsync("/api/settings/devices");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var list = await response.Content.ReadFromJsonAsync<List<SettingsDeviceDto>>();
        list.ShouldNotBeNull();
        list.Count.ShouldBe(1);
        list[0].MacAddress.ShouldBe(WeatherTestData.Mac);
        list[0].Nickname.ShouldBe("Back");
        list[0].IsPrimary.ShouldBeTrue();
    }

    [Fact]
    public async Task GetDevicesShouldReflectCurrentUserOnlyNotAnotherUser()
    {
        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationsAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync([StationA]);
        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationsAsync(UserBSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        using var clientA = CreateAuthenticatedClient(UserASubject);
        using var clientB = CreateAuthenticatedClient(UserBSubject);

        var responseA = await clientA.GetAsync("/api/settings/devices");
        var responseB = await clientB.GetAsync("/api/settings/devices");

        var listA = await responseA.Content.ReadFromJsonAsync<List<SettingsDeviceDto>>();
        var listB = await responseB.Content.ReadFromJsonAsync<List<SettingsDeviceDto>>();

        listA.ShouldNotBeNull();
        listB.ShouldNotBeNull();
        listA.Count.ShouldBe(1);
        listB.ShouldBeEmpty();
    }

    // -------------------------------------------------------------------------
    // POST /api/settings/devices/sync
    // -------------------------------------------------------------------------

    [Fact]
    public async Task SyncDevicesShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.PostAsync("/api/settings/devices/sync", null);
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SyncDevicesShouldReturn428WhenCredentialsMissing()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PostAsync("/api/settings/devices/sync", null);

        // AmbientCredentialsRequiredException → GlobalExceptionHandlerMiddleware → 428
        response.StatusCode.ShouldBe(HttpStatusCode.PreconditionRequired);
    }

    [Fact]
    public async Task SyncDevicesShouldReturn400WhenAmbientAuthFails()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials(ValidApiKey, ValidAppKey));
        _factory.AmbientRestClientMock
            .Setup(c => c.GetDevicesAsync(ValidApiKey, ValidAppKey, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmbientApiAuthException());

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PostAsync("/api/settings/devices/sync", null);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("ambient-credentials-invalid");
    }

    [Fact]
    public async Task SyncDevicesShouldCallStationStoreWithDevicesFromAmbient()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials(ValidApiKey, ValidAppKey));
        _factory.AmbientRestClientMock
            .Setup(c => c.GetDevicesAsync(ValidApiKey, ValidAppKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync([DeviceFromAmbient]);
        _factory.StationStoreMock
            .Setup(s => s.SyncStationsAsync(UserASubject, null, It.IsAny<IReadOnlyList<DeviceDto>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([StationA]);

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PostAsync("/api/settings/devices/sync", null);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        _factory.StationStoreMock.Verify(
            s => s.SyncStationsAsync(
                UserASubject,
                It.IsAny<string?>(),
                It.Is<IReadOnlyList<DeviceDto>>(d => d.Count == 1),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // -------------------------------------------------------------------------
    // PUT /api/settings/devices/{mac}
    // -------------------------------------------------------------------------

    [Fact]
    public async Task UpdateDeviceShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();
        var response = await client.PutAsJsonAsync($"/api/settings/devices/{WeatherTestData.Mac}", new { });
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateDeviceShouldReturn404WhenMacNotOwned()
    {
        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationByMacAsync(UserASubject, WeatherTestData.Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PutAsJsonAsync(
            $"/api/settings/devices/{WeatherTestData.Mac}",
            new { nickname = "Test" });

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("station-not-found");
    }

    [Fact]
    public async Task UpdateDeviceShouldReturn400WhenNicknameTooLong()
    {
        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PutAsJsonAsync(
            $"/api/settings/devices/{WeatherTestData.Mac}",
            new { nickname = new string('x', 129) });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("validation-failed");
    }

    [Fact]
    public async Task UpdateDeviceShouldReturn400WhenMetricKeyUnrecognised()
    {
        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PutAsJsonAsync(
            $"/api/settings/devices/{WeatherTestData.Mac}",
            new { selectedMetricKeys = (string[])["not_a_valid_key"] });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateDeviceShouldReturn400WhenMacAddressInvalid()
    {
        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PutAsJsonAsync(
            "/api/settings/devices/not-a-mac",
            new { nickname = "Test" });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateDeviceShouldReturn204AndSaveNickname()
    {
        var station = new WeatherStation
        {
            MacAddress = WeatherTestData.Mac,
            IsPrimary = false,
            DisplayOnDashboard = true,
        };

        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationByMacAsync(UserASubject, WeatherTestData.Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync(station);
        _factory.StationStoreMock
            .Setup(s => s.SaveAsync(station, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PutAsJsonAsync(
            $"/api/settings/devices/{WeatherTestData.Mac}",
            new { nickname = "Rooftop" });

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        station.Nickname.ShouldBe("Rooftop");
    }

    [Fact]
    public async Task UpdateDeviceShouldReturn204AndSavePrimaryFlag()
    {
        var station = new WeatherStation
        {
            MacAddress = WeatherTestData.Mac,
            IsPrimary = false,
            DisplayOnDashboard = true,
        };

        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationByMacAsync(UserASubject, WeatherTestData.Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync(station);
        _factory.StationStoreMock
            .Setup(s => s.SaveAsync(station, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PutAsJsonAsync(
            $"/api/settings/devices/{WeatherTestData.Mac}",
            new { isPrimary = true });

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        station.IsPrimary.ShouldBeTrue();
    }

    [Fact]
    public async Task UpdateDeviceShouldNotAllowUserBToUpdateUserAStation()
    {
        _factory.StationStoreMock
            .Setup(s => s.GetOwnedStationByMacAsync(UserBSubject, WeatherTestData.Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        using var clientB = CreateAuthenticatedClient(UserBSubject);
        var response = await clientB.PutAsJsonAsync(
            $"/api/settings/devices/{WeatherTestData.Mac}",
            new { nickname = "Stolen" });

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private HttpClient CreateAuthenticatedClient(string subject, string? email = null) =>
        _factory.CreateAuthenticatedClient(subject, email);
}

/// <summary>
/// <see cref="WebApplicationFactory{TProgram}"/> for device settings integration tests.
/// Mocks <see cref="IUserStationStore"/>, <see cref="IAmbientCredentialStore"/>, and
/// <see cref="IAmbientRestClient"/> to avoid a real database or Ambient API.
/// </summary>
public sealed class SettingsDevicesTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock for <see cref="IUserStationStore"/>.</summary>
    public Mock<IUserStationStore> StationStoreMock { get; } = new();

    /// <summary>Mock for <see cref="IAmbientCredentialStore"/>.</summary>
    public Mock<IAmbientCredentialStore> CredentialStoreMock { get; } = new();

    /// <summary>Mock for <see cref="IAmbientRestClient"/>.</summary>
    public Mock<IAmbientRestClient> AmbientRestClientMock { get; } = new();

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

            services.AddScoped<IUserStationStore>(_ => StationStoreMock.Object);
            services.AddScoped<IAmbientCredentialStore>(_ => CredentialStoreMock.Object);
            services.AddScoped<IAmbientRestClient>(_ => AmbientRestClientMock.Object);
        });
    }
}
