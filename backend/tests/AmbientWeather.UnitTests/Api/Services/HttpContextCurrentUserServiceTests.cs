using AmbientWeather.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Api.Services;

/// <summary>Tests for resolving the current user from HTTP context and dev auth bypass config.</summary>
public sealed class HttpContextCurrentUserServiceTests
{
    [Fact]
    public void IsAuthenticatedUsesDevBypassWhenJwtIsConfiguredAndBypassIsEnabled()
    {
        var service = CreateService(
            environmentName: Environments.Development,
            settings: CreateSettings(
                ("Authentication:Authority", "https://example.auth0.com/"),
                ("DevAuthBypass", "true")));

        service.IsAuthenticated.ShouldBeTrue();
        service.AuthProviderSubject.ShouldBe("dev|swagger-user");
        service.Email.ShouldBe("dev@localhost");
    }

    [Fact]
    public void IsAuthenticatedDoesNotUseDevBypassWhenJwtIsConfiguredAndBypassIsDisabled()
    {
        var service = CreateService(
            environmentName: Environments.Development,
            settings: CreateSettings(
                ("Authentication:Authority", "https://example.auth0.com/"),
                ("DevAuthBypass", "false")));

        service.IsAuthenticated.ShouldBeFalse();
        service.AuthProviderSubject.ShouldBeNull();
        service.Email.ShouldBeNull();
    }

    private static HttpContextCurrentUserService CreateService(
        string environmentName,
        Dictionary<string, string?> settings)
    {
        var httpContextAccessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext(),
        };

        var environment = new Mock<IHostEnvironment>();
        environment.SetupGet(static env => env.EnvironmentName).Returns(environmentName);

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings)
            .Build();

        return new HttpContextCurrentUserService(httpContextAccessor, environment.Object, configuration);
    }

    private static Dictionary<string, string?> CreateSettings(
        params (string Key, string? Value)[] entries) =>
        entries.ToDictionary(static entry => entry.Key, static entry => entry.Value, StringComparer.Ordinal);
}
