using System.Security.Claims;
using AmbientWeather.Application.Interfaces;

namespace AmbientWeather.Api.Services;

/// <summary>
/// Resolves current user identity details from the active HTTP context.
/// In Development without JWT configured, or with <c>DevAuthBypass=true</c>, returns a
/// synthetic dev identity so Swagger UI can exercise authenticated endpoints without a
/// real Auth0 token.
/// </summary>
public sealed class HttpContextCurrentUserService(
    IHttpContextAccessor httpContextAccessor,
    IHostEnvironment environment,
    IConfiguration configuration) : ICurrentUserService
{
    internal const string DevSubject = "dev|swagger-user";
    private const string DevEmail = "dev@localhost";

    /// <summary>
    /// Returns <see langword="true"/> when the Development auth bypass should be active.
    /// Shared with <see cref="Hubs.WeatherHub"/> so both code paths read the same config keys.
    /// </summary>
    internal static bool IsDevBypassActive(IHostEnvironment environment, IConfiguration configuration) =>
        environment.IsDevelopment() && (
            string.IsNullOrWhiteSpace(configuration["Authentication:Authority"] ?? configuration["Auth0:Authority"])
            || string.Equals(configuration["DevAuthBypass"], "true", StringComparison.OrdinalIgnoreCase));

    /// <summary>True when Development should use a synthetic user identity.</summary>
    private bool DevBypassActive => IsDevBypassActive(environment, configuration);

    /// <inheritdoc />
    public bool IsAuthenticated =>
        Principal?.Identity?.IsAuthenticated == true || DevBypassActive;

    /// <inheritdoc />
    public string? AuthProviderSubject =>
        Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? Principal?.FindFirstValue("sub")
        ?? (DevBypassActive ? DevSubject : null);

    /// <inheritdoc />
    public string? Email =>
        Principal?.FindFirstValue(ClaimTypes.Email)
        ?? Principal?.FindFirstValue("email")
        ?? (DevBypassActive ? DevEmail : null);

    /// <inheritdoc />
    public ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;
}
