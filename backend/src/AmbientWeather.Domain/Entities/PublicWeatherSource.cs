namespace AmbientWeather.Domain.Entities;

/// <summary>
/// User-selected public weather source that can appear in default or custom layouts.
/// </summary>
public sealed class PublicWeatherSource
{
    /// <summary>
    /// Source identifier.
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// User that owns this source selection.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Public provider key, for example WeatherGov or OpenMeteo.
    /// </summary>
    public required string Provider { get; set; }

    /// <summary>
    /// Provider-specific station or location identifier.
    /// </summary>
    public required string SourceId { get; set; }

    /// <summary>
    /// User-facing display label for the selected location.
    /// </summary>
    public required string DisplayLabel { get; set; }

    /// <summary>
    /// Selected source latitude in decimal degrees.
    /// </summary>
    public double Latitude { get; set; }

    /// <summary>
    /// Selected source longitude in decimal degrees.
    /// </summary>
    public double Longitude { get; set; }

    /// <summary>
    /// Optional IANA timezone for the selected location.
    /// </summary>
    public string? Timezone { get; set; }

    /// <summary>
    /// Whether this source is enabled for dashboard layouts.
    /// </summary>
    public bool IsEnabled { get; set; } = true;

    /// <summary>
    /// JSON array of selected metric keys for this source. <see langword="null"/> means all
    /// provider-supported metrics are selected.
    /// </summary>
    public string? SelectedMetricKeysJson { get; set; }

    /// <summary>
    /// UTC timestamp when the source was created.
    /// </summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// UTC timestamp when the source was last updated.
    /// </summary>
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// User that owns this source selection.
    /// </summary>
    public AppUser? User { get; set; }
}
