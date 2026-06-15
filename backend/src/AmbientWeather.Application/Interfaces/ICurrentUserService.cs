using System.Security.Claims;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Provides authenticated user identity details to application handlers.
/// </summary>
public interface ICurrentUserService
{
    /// <summary>
    /// Gets a value indicating whether the current request has an authenticated user.
    /// </summary>
    bool IsAuthenticated { get; }

    /// <summary>
    /// Gets the authentication provider subject claim for the current user.
    /// </summary>
    string? AuthProviderSubject { get; }

    /// <summary>
    /// Gets the email claim for the current user when supplied by the identity provider.
    /// </summary>
    string? Email { get; }

    /// <summary>
    /// Gets the claims principal for the current request.
    /// </summary>
    ClaimsPrincipal? Principal { get; }
}
