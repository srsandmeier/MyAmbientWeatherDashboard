namespace AmbientWeather.Domain.Entities;

/// <summary>
/// Application user mapped from an external authentication provider subject.
/// </summary>
public sealed class AppUser
{
    /// <summary>
    /// Internal user identifier.
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// External authentication provider subject claim.
    /// </summary>
    public required string AuthProviderSubject { get; set; }

    /// <summary>
    /// User email address for display and lookup.
    /// </summary>
    public string? Email { get; set; }

    /// <summary>
    /// UTC timestamp when the user was first created.
    /// </summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Encrypted Ambient Weather credentials for the user.
    /// </summary>
    public UserAmbientCredentials? AmbientCredentials { get; set; }

    /// <summary>
    /// User preferences.
    /// </summary>
    public UserPreferences? Preferences { get; set; }

    /// <summary>
    /// Dashboard layouts owned by the user.
    /// </summary>
    public ICollection<DashboardLayout> DashboardLayouts { get; } = [];

    /// <summary>
    /// Weather stations owned or cached for the user.
    /// </summary>
    public ICollection<WeatherStation> WeatherStations { get; } = [];

    /// <summary>
    /// Public weather sources selected by the user.
    /// </summary>
    public ICollection<PublicWeatherSource> PublicWeatherSources { get; } = [];
}
