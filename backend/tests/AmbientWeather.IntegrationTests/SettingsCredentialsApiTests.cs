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
/// Integration tests for <c>GET/POST/DELETE /api/settings/credentials</c>.
/// Uses <see cref="TestAuthHandler"/> to supply synthetic identities without a real Auth0 token.
/// Mocks <see cref="IAmbientCredentialStore"/> and <see cref="IAmbientRestClient"/> so the tests
/// verify HTTP plumbing, auth enforcement, current-user resolution, and user isolation without
/// needing a running database or Ambient API.
/// </summary>
public sealed class SettingsCredentialsApiTests : IClassFixture<SettingsCredentialsTestFactory>
{
    private const string UserASubject = "auth0|test-user-a";
    private const string UserBSubject = "auth0|test-user-b";
    private const string ValidApiKey = "valid-api-key";
    private const string ValidAppKey = "valid-app-key";

    private readonly SettingsCredentialsTestFactory _factory;

    public SettingsCredentialsApiTests(SettingsCredentialsTestFactory factory)
    {
        _factory = factory;
        // Reset mocks before each test so setups do not bleed across tests.
        _factory.CredentialStoreMock.Reset();
        _factory.AmbientRestClientMock.Reset();
        _factory.PreferenceStoreMock.Reset();
        _factory.StationStoreMock.Reset();
        // Default: SyncStationsAsync succeeds with empty list so credential-save tests pass.
        _factory.StationStoreMock
            .Setup(s => s.SyncStationsAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<IReadOnlyList<DeviceDto>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
    }

    // -------------------------------------------------------------------------
    // GET /api/settings/credentials
    // -------------------------------------------------------------------------

    [Fact]
    public async Task GetCredentialStatusShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/settings/credentials");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetCredentialStatusShouldReturnHasCredentialsFalseWhenNoneStored()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.GetAsync("/api/settings/credentials");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<AmbientCredentialStatusDto>();
        dto.ShouldNotBeNull();
        dto.HasCredentials.ShouldBeFalse();
    }

    [Fact]
    public async Task GetCredentialStatusShouldReturnHasCredentialsTrueWhenStored()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials(ValidApiKey, ValidAppKey));

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.GetAsync("/api/settings/credentials");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<AmbientCredentialStatusDto>();
        dto.ShouldNotBeNull();
        dto.HasCredentials.ShouldBeTrue();
    }

    [Fact]
    public async Task GetCredentialStatusShouldNeverExposeRawCredentialValuesInResponseBody()
    {
        // Even when credentials exist the response must never leak the plaintext keys.
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials(ValidApiKey, ValidAppKey));

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.GetAsync("/api/settings/credentials");

        var body = await response.Content.ReadAsStringAsync();
        body.ShouldNotContain(ValidApiKey);
        body.ShouldNotContain(ValidAppKey);
        body.ShouldNotContain("apiKey", Case.Insensitive);
        body.ShouldNotContain("applicationKey", Case.Insensitive);
    }

    // -------------------------------------------------------------------------
    // POST /api/settings/credentials
    // -------------------------------------------------------------------------

    [Fact]
    public async Task SaveCredentialsShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/settings/credentials",
            new { apiKey = ValidApiKey, applicationKey = ValidAppKey });

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SaveCredentialsShouldReturnNoContentWhenCredentialsPassAmbientValidation()
    {
        _factory.AmbientRestClientMock
            .Setup(c => c.GetDevicesAsync(ValidApiKey, ValidAppKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<DeviceDto>());

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PostAsJsonAsync(
            "/api/settings/credentials",
            new { apiKey = ValidApiKey, applicationKey = ValidAppKey });

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task SaveCredentialsShouldReturnBadRequestWhenAmbientValidationFails()
    {
        _factory.AmbientRestClientMock
            .Setup(c => c.GetDevicesAsync(ValidApiKey, ValidAppKey, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmbientApiAuthException());

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.PostAsJsonAsync(
            "/api/settings/credentials",
            new { apiKey = ValidApiKey, applicationKey = ValidAppKey });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("ambient-credentials-invalid");
    }

    [Fact]
    public async Task SaveCredentialsShouldReturnBadRequestWhenPayloadFailsFluentValidation()
    {
        using var client = CreateAuthenticatedClient(UserASubject);

        // Empty API key fails FluentValidation before reaching the Ambient test call.
        var response = await client.PostAsJsonAsync(
            "/api/settings/credentials",
            new { apiKey = string.Empty, applicationKey = ValidAppKey });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("validation-failed");
    }

    // -------------------------------------------------------------------------
    // DELETE /api/settings/credentials
    // -------------------------------------------------------------------------

    [Fact]
    public async Task DeleteCredentialsShouldReturn401WhenUnauthenticated()
    {
        using var client = _factory.CreateClient();

        var response = await client.DeleteAsync("/api/settings/credentials");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteCredentialsShouldReturnNoContentWhenAuthenticated()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.DeleteAsync(UserASubject, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        using var client = CreateAuthenticatedClient(UserASubject);
        var response = await client.DeleteAsync("/api/settings/credentials");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    // -------------------------------------------------------------------------
    // User isolation
    // -------------------------------------------------------------------------

    [Fact]
    public async Task GetCredentialStatusShouldReflectCurrentUserSubjectNotAnotherUser()
    {
        // User A has credentials; user B does not.
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserASubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials(ValidApiKey, ValidAppKey));
        _factory.CredentialStoreMock
            .Setup(s => s.GetAsync(UserBSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        using var clientA = CreateAuthenticatedClient(UserASubject);
        using var clientB = CreateAuthenticatedClient(UserBSubject);

        var responseA = await clientA.GetAsync("/api/settings/credentials");
        var responseB = await clientB.GetAsync("/api/settings/credentials");

        responseA.StatusCode.ShouldBe(HttpStatusCode.OK);
        responseB.StatusCode.ShouldBe(HttpStatusCode.OK);

        var dtoA = await responseA.Content.ReadFromJsonAsync<AmbientCredentialStatusDto>();
        var dtoB = await responseB.Content.ReadFromJsonAsync<AmbientCredentialStatusDto>();

        dtoA.ShouldNotBeNull();
        dtoB.ShouldNotBeNull();
        dtoA.HasCredentials.ShouldBeTrue("User A should see their own stored credentials.");
        dtoB.HasCredentials.ShouldBeFalse("User B should not see user A's credentials.");
    }

    [Fact]
    public async Task SaveCredentialsShouldPassCurrentUserSubjectToStore()
    {
        _factory.AmbientRestClientMock
            .Setup(c => c.GetDevicesAsync(ValidApiKey, ValidAppKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<DeviceDto>());

        using var clientA = CreateAuthenticatedClient(UserASubject, "user-a@example.com");
        await clientA.PostAsJsonAsync(
            "/api/settings/credentials",
            new { apiKey = ValidApiKey, applicationKey = ValidAppKey });

        // Store must be called with user A's subject; user B's subject must never be used.
        _factory.CredentialStoreMock.Verify(
            s => s.SaveAsync(
                UserASubject,
                "user-a@example.com",
                ValidApiKey,
                ValidAppKey,
                It.IsAny<CancellationToken>()),
            Times.Once);
        _factory.CredentialStoreMock.Verify(
            s => s.SaveAsync(
                UserBSubject,
                It.IsAny<string?>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task DeleteCredentialsShouldPassCurrentUserSubjectToStore()
    {
        _factory.CredentialStoreMock
            .Setup(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        using var clientA = CreateAuthenticatedClient(UserASubject);
        await clientA.DeleteAsync("/api/settings/credentials");

        // Store must be called with user A's subject only.
        _factory.CredentialStoreMock.Verify(
            s => s.DeleteAsync(UserASubject, It.IsAny<CancellationToken>()),
            Times.Once);
        _factory.CredentialStoreMock.Verify(
            s => s.DeleteAsync(UserBSubject, It.IsAny<CancellationToken>()),
            Times.Never);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private HttpClient CreateAuthenticatedClient(string subject, string? email = null) =>
        _factory.CreateAuthenticatedClient(subject, email);
}

/// <summary>
/// <see cref="WebApplicationFactory{TProgram}"/> for settings credential integration tests.
/// Registers <see cref="TestAuthHandler"/> as the default scheme, and exposes
/// <see cref="IAmbientCredentialStore"/> and <see cref="IAmbientRestClient"/> mocks so tests
/// can configure behaviour and verify calls without a database or live Ambient API.
/// </summary>
public sealed class SettingsCredentialsTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock for <see cref="IAmbientCredentialStore"/>.</summary>
    public Mock<IAmbientCredentialStore> CredentialStoreMock { get; } = new();

    /// <summary>Mock for <see cref="IAmbientRestClient"/>.</summary>
    public Mock<IAmbientRestClient> AmbientRestClientMock { get; } = new();

    /// <summary>Mock for <see cref="IUserPreferencesStore"/>.</summary>
    public Mock<IUserPreferencesStore> PreferenceStoreMock { get; } = new();

    /// <summary>Mock for <see cref="IUserStationStore"/>.</summary>
    public Mock<IUserStationStore> StationStoreMock { get; } = new();

    /// <summary>
    /// Creates an authenticated <see cref="HttpClient"/> by setting the
    /// <c>X-Test-User-Subject</c> (and optionally <c>X-Test-User-Email</c>) headers.
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
                ["AmbientWeather:ApplicationKey"] = "test-application-key"
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

            // Register mocks last so they override any concrete registrations from AddInfrastructure.
            services.AddScoped<IAmbientCredentialStore>(_ => CredentialStoreMock.Object);
            services.AddScoped<IAmbientRestClient>(_ => AmbientRestClientMock.Object);
            services.AddScoped<IUserPreferencesStore>(_ => PreferenceStoreMock.Object);
            services.AddScoped<IUserStationStore>(_ => StationStoreMock.Object);
        });
    }
}
