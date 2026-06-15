namespace AmbientWeather.Application.DTOs.Settings;

/// <summary>
/// Safe credential status response for the authenticated user.
/// </summary>
public sealed record AmbientCredentialStatusDto
{
    /// <summary>
    /// Gets a value indicating whether Ambient Weather credentials are saved for the current user.
    /// </summary>
    public required bool HasCredentials { get; init; }
}
