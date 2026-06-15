using System.Text.Json.Serialization;

namespace AmbientWeather.Domain.Neighbors;

/// <summary>
/// User-configurable settings for nearby public station discovery.
/// Stored as JSON in <c>user_preferences.neighbor_config_json</c>; coordinates are
/// populated at runtime from the user's primary station and never persisted.
/// </summary>
public sealed record NeighborConfig
{
    /// <summary>
    /// Whether the neighbor comparison feature is enabled for this user.
    /// </summary>
    public bool IsEnabled { get; init; }

    /// <summary>
    /// Owned station MAC addresses that have neighbor comparison enabled. Empty means no
    /// station-specific opt-in has been saved yet; <see cref="IsEnabled"/> remains as a
    /// legacy global fallback for older saved configurations.
    /// </summary>
    public IReadOnlyList<string> EnabledStationMacAddresses { get; init; } = [];

    /// <summary>
    /// Public station-finder discovery radius in miles. Valid range: 5–50.
    /// </summary>
    public double RadiusMiles { get; init; } = 25;

    /// <summary>
    /// Ambient Weather neighbor comparison radius in miles. Valid range: 0.5–34.
    /// </summary>
    public double ComparisonRadiusMiles { get; init; } = 25;

    /// <summary>
    /// Maximum age of a station's last observation before it is excluded. Valid range: 5–120.
    /// </summary>
    public int MaxAgeMinutes { get; init; } = 30;

    /// <summary>
    /// Minimum number of stations required before aggregation is considered reliable.
    /// </summary>
    public int MinStations { get; init; } = 3;

    /// <summary>
    /// Provider names to query during discovery. Subset of: <c>AmbientOpen</c>, <c>WeatherGov</c>,
    /// <c>OpenMeteo</c>. Empty list enables all non-feature-flagged providers.
    /// </summary>
    public IReadOnlyList<string> EnabledProviders { get; init; } =
        new[] { "WeatherGov", "OpenMeteo" };

    /// <summary>
    /// How long discovered station lists are cached before a background re-discovery is triggered.
    /// Valid range: 5–60 minutes.
    /// </summary>
    public int RefreshIntervalMinutes { get; init; } = 15;

    /// <summary>
    /// Optional ZIP code, city/state, or place query used for neighbor discovery when no
    /// owned station coordinates are available.
    /// </summary>
    public string? DiscoveryLocationQuery { get; init; }

    /// <summary>
    /// Optional municipality or location used to fetch public weather alerts (e.g. "Dallas, TX").
    /// When set, the alerts endpoint uses this as the human-readable area label; falls back to
    /// station coordinates for NWS point lookup when absent.
    /// </summary>
    public string? Municipality { get; init; }

    /// <summary>
    /// Specific nearby public stations the user has pinned for persistent display on the
    /// dashboard alongside owned stations.
    /// </summary>
    public IReadOnlyList<PinnedNeighborStation> PinnedStations { get; init; } = [];

    // ── Runtime fields — not serialized ──────────────────────────────────────

    /// <summary>
    /// Latitude of the user's primary station in decimal degrees. Set at runtime; not persisted.
    /// </summary>
    [JsonIgnore]
    public double? UserLatitude { get; init; }

    /// <summary>
    /// Longitude of the user's primary station in decimal degrees. Set at runtime; not persisted.
    /// </summary>
    [JsonIgnore]
    public double? UserLongitude { get; init; }

    /// <summary>
    /// Human-readable label for the runtime coordinates. Set at runtime; not persisted.
    /// </summary>
    [JsonIgnore]
    public string? UserLocationLabel { get; init; }

    /// <summary>
    /// Runtime cache namespace for the current discovery purpose. Set at runtime; not persisted.
    /// </summary>
    [JsonIgnore]
    public string? DiscoveryCacheScope { get; init; }

    /// <summary>
    /// Whether this discovery should bypass the cached station list. Set at runtime; not persisted.
    /// </summary>
    [JsonIgnore]
    public bool ForceRefresh { get; init; }
}
