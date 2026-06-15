namespace AmbientWeather.Domain.Entities;

/// <summary>
/// Encrypted Ambient Weather API credentials for a user.
/// </summary>
public sealed class UserAmbientCredentials
{
    /// <summary>
    /// User that owns these credentials.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Encrypted Ambient Weather API key.
    /// </summary>
    public required string ApiKeyEncrypted { get; set; }

    /// <summary>
    /// Encrypted Ambient Weather application key.
    /// </summary>
    public required string ApplicationKeyEncrypted { get; set; }

    /// <summary>
    /// UTC timestamp when credentials were last updated.
    /// </summary>
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// User that owns these credentials.
    /// </summary>
    public AppUser? User { get; set; }
}
