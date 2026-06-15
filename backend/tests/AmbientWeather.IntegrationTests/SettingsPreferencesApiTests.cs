using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.DTOs.Common;
using AmbientWeather.Application.DTOs.Settings;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using Moq;
using Shouldly;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Integration tests for <c>GET/PUT /api/settings/preferences</c>.
/// Uses the shared <see cref="SettingsCredentialsTestFactory"/> which already registers
/// <see cref="Auth.TestAuthHandler"/> and a <see cref="IUserPreferencesStore"/> mock.
/// </summary>
public sealed class SettingsPreferencesApiTests : IClassFixture<SettingsCredentialsTestFactory>
{
    private const string UserSubject = "auth0|prefs-test-user";
    private readonly SettingsCredentialsTestFactory _factory;

    public SettingsPreferencesApiTests(SettingsCredentialsTestFactory factory)
    {
        _factory = factory;
        // Reset all mocks — not just PreferenceStoreMock — so stale setups from any
        // earlier test in this class cannot affect subsequent tests.
        _factory.CredentialStoreMock.Reset();
        _factory.AmbientRestClientMock.Reset();
        _factory.PreferenceStoreMock.Reset();
    }

    // -------------------------------------------------------------------------
    // GET /api/settings/preferences
    // -------------------------------------------------------------------------

    [Fact]
    public async Task GetPreferencesShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/settings/preferences");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetPreferencesShouldReturnDefaultsWhenNoneStoredYet()
    {
        _factory.PreferenceStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences());

        using var client = _factory.CreateAuthenticatedClient(UserSubject);
        var response = await client.GetAsync("/api/settings/preferences");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<UserPreferencesDto>();
        dto.ShouldNotBeNull();
        dto.TemperatureUnit.ShouldBe("F");
        dto.SpeedUnit.ShouldBe("mph");
        dto.DistanceUnit.ShouldBe("mi");
        dto.Theme.ShouldBe("system");
        dto.DateFormat.ShouldBe("mdy");
    }

    [Fact]
    public async Task GetPreferencesShouldReturnStoredValues()
    {
        _factory.PreferenceStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences { TemperatureUnit = "C", SpeedUnit = "kmh", Theme = "dark", DateFormat = "iso", PressureUnit = "hpa", RainfallUnit = "mm", DistanceUnit = "km" });

        using var client = _factory.CreateAuthenticatedClient(UserSubject);
        var response = await client.GetAsync("/api/settings/preferences");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<UserPreferencesDto>();
        dto.ShouldNotBeNull();
        dto.TemperatureUnit.ShouldBe("C");
        dto.DistanceUnit.ShouldBe("km");
        dto.Theme.ShouldBe("dark");
        dto.DateFormat.ShouldBe("iso");
    }

    // -------------------------------------------------------------------------
    // PUT /api/settings/preferences
    // -------------------------------------------------------------------------

    [Fact]
    public async Task UpdatePreferencesShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync(
            "/api/settings/preferences",
            new { temperatureUnit = "C", speedUnit = "kmh", pressureUnit = "hpa", rainfallUnit = "mm", distanceUnit = "km", theme = "dark", dateFormat = "iso" });

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdatePreferencesShouldReturnOkWithUpdatedDtoOnValidPayload()
    {
        var stored = new UserPreferences();
        _factory.PreferenceStoreMock
            .Setup(s => s.GetOrCreateAsync(UserSubject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(stored);
        _factory.PreferenceStoreMock
            .Setup(s => s.SaveAsync(stored, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        using var client = _factory.CreateAuthenticatedClient(UserSubject);
        var response = await client.PutAsJsonAsync(
            "/api/settings/preferences",
            new { temperatureUnit = "C", speedUnit = "kmh", pressureUnit = "hpa", rainfallUnit = "mm", distanceUnit = "km", theme = "dark", dateFormat = "dmy" });

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<UserPreferencesDto>();
        dto.ShouldNotBeNull();
        dto.TemperatureUnit.ShouldBe("C");
        dto.DistanceUnit.ShouldBe("km");
        dto.Theme.ShouldBe("dark");
        dto.DateFormat.ShouldBe("dmy");
    }

    [Fact]
    public async Task UpdatePreferencesShouldReturnBadRequestOnInvalidUnitValue()
    {
        using var client = _factory.CreateAuthenticatedClient(UserSubject);

        var response = await client.PutAsJsonAsync(
            "/api/settings/preferences",
            new { temperatureUnit = "K", speedUnit = "mph", pressureUnit = "inhg", rainfallUnit = "in", distanceUnit = "mi", theme = "system", dateFormat = "mdy" });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("validation-failed");
    }
}
