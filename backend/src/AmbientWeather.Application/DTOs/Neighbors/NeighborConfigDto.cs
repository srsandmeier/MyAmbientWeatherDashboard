using AmbientWeather.Domain.Neighbors;

namespace AmbientWeather.Application.DTOs.Neighbors;

/// <summary>
/// Neighbor comparison configuration returned by <c>GET /api/neighbors/config</c> and
/// <c>PUT /api/neighbors/config</c>.
/// </summary>
public sealed record NeighborConfigDto
{
    /// <summary>Whether the neighbor comparison feature is enabled.</summary>
    public required bool IsEnabled { get; init; }

    /// <summary>Owned station MAC addresses with neighbor comparison enabled.</summary>
    public IReadOnlyList<string> EnabledStationMacAddresses { get; init; } = [];

    /// <summary>Discovery radius in miles.</summary>
    public required double RadiusMiles { get; init; }

    /// <summary>Ambient Weather neighbor comparison radius in miles.</summary>
    public required double ComparisonRadiusMiles { get; init; }

    /// <summary>Maximum age in minutes of a station's last observation before it is excluded.</summary>
    public required int MaxAgeMinutes { get; init; }

    /// <summary>Minimum number of stations required for aggregation to be considered reliable.</summary>
    public required int MinStations { get; init; }

    /// <summary>Provider names enabled for discovery.</summary>
    public required IReadOnlyList<string> EnabledProviders { get; init; }

    /// <summary>How long discovered station lists are cached before re-discovery.</summary>
    public required int RefreshIntervalMinutes { get; init; }

    /// <summary>Optional ZIP code, city/state, or place query for neighbor discovery.</summary>
    public string? DiscoveryLocationQuery { get; init; }

    /// <summary>Optional municipality or location for weather alert lookups.</summary>
    public string? Municipality { get; init; }

    /// <summary>Stations the user has pinned for persistent display on the dashboard.</summary>
    public IReadOnlyList<PinnedNeighborStationDto> PinnedStations { get; init; } = [];

    /// <summary>
    /// Whether the Ambient Open API provider is available on this server instance
    /// (controlled by <c>Features:AmbientOpenApiEnabled</c>). When <c>false</c> the frontend
    /// should disable the AmbientOpen provider checkbox.
    /// </summary>
    public bool IsAmbientOpenAvailable { get; init; }

    /// <summary>
    /// The maximum radius in miles that the Ambient Open API bounding-box endpoint reliably
    /// supports. Queries beyond this distance return no additional stations. The provider
    /// clamps its bounding box to this value automatically; this field lets the frontend
    /// inform the user when their configured radius exceeds the effective limit.
    /// </summary>
    public double AmbientOpenMaxRadiusMiles { get; init; }

    /// <summary>
    /// Maps a <see cref="NeighborConfig"/> domain object to a <see cref="NeighborConfigDto"/>.
    /// </summary>
    public static NeighborConfigDto From(NeighborConfig config) => new()
    {
        IsEnabled = config.IsEnabled,
        EnabledStationMacAddresses = config.EnabledStationMacAddresses,
        RadiusMiles = config.RadiusMiles,
        ComparisonRadiusMiles = config.ComparisonRadiusMiles,
        MaxAgeMinutes = config.MaxAgeMinutes,
        MinStations = config.MinStations,
        EnabledProviders = config.EnabledProviders,
        RefreshIntervalMinutes = config.RefreshIntervalMinutes,
        DiscoveryLocationQuery = config.DiscoveryLocationQuery,
        Municipality = config.Municipality,
        PinnedStations = config.PinnedStations
            .Select(PinnedNeighborStationDto.From)
            .ToList(),
    };
}
