namespace AmbientWeather.Domain.Entities;

/// <summary>
/// Cached nearby public station discovered by a neighbor provider for a given user.
/// Keyed by the user's hash (not a FK) so the cache can be written by the background
/// discovery service without requiring a joined user lookup.
/// </summary>
public sealed class NeighborStationCache
{
    /// <summary>
    /// Surrogate primary key.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Hashed user identifier (matches the Redis user-segment hash).
    /// </summary>
    public string UserHash { get; set; } = string.Empty;

    /// <summary>
    /// Name of the provider that supplied this station: <c>AmbientOpen</c>, <c>WeatherGov</c>,
    /// or <c>OpenMeteo</c>.
    /// </summary>
    public string Provider { get; set; } = string.Empty;

    /// <summary>
    /// Provider-assigned station identifier (MAC address, NWS station ID, etc.).
    /// </summary>
    public string SourceId { get; set; } = string.Empty;

    /// <summary>
    /// Human-readable station name.
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// Station latitude in decimal degrees.
    /// </summary>
    public double Lat { get; set; }

    /// <summary>
    /// Station longitude in decimal degrees.
    /// </summary>
    public double Lon { get; set; }

    /// <summary>
    /// Distance from the user's primary station in miles.
    /// </summary>
    public double DistanceMiles { get; set; }

    /// <summary>
    /// UTC timestamp of the station's most recent observation included in this cache entry.
    /// Null when the provider did not supply an observation time.
    /// </summary>
    public DateTime? LastObservedAtUtc { get; set; }

    /// <summary>
    /// Age of the cached observation in minutes at the time it was cached.
    /// Null when <see cref="LastObservedAtUtc"/> is unavailable.
    /// </summary>
    public int? FreshnessMinutes { get; set; }

    /// <summary>
    /// Provider-specific reading fields serialized as JSON text.
    /// Shape mirrors <c>IAmbientSensorFields</c> subset; null when no reading was available.
    /// </summary>
    public string? RawReadingJson { get; set; }

    /// <summary>
    /// UTC timestamp when this entry was written to the cache.
    /// </summary>
    public DateTime CachedAtUtc { get; set; } = DateTime.UtcNow;
}
