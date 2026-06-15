using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Domain.Neighbors;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Commands;

/// <summary>
/// Updates the neighbor comparison configuration for the authenticated user.
/// </summary>
/// <param name="IsEnabled">Whether the neighbor comparison feature is enabled.</param>
/// <param name="EnabledStationMacAddresses">Owned station MAC addresses with neighbor comparison enabled.</param>
/// <param name="RadiusMiles">Public station-finder discovery radius in miles (5–50).</param>
/// <param name="ComparisonRadiusMiles">Ambient Weather neighbor comparison radius in miles (0.5–34).</param>
/// <param name="MaxAgeMinutes">Maximum observation age in minutes (5–120).</param>
/// <param name="MinStations">Minimum station count for reliable aggregation (1–20).</param>
/// <param name="EnabledProviders">Provider names to query: <c>AmbientOpen</c>, <c>WeatherGov</c>, <c>OpenMeteo</c>.</param>
/// <param name="RefreshIntervalMinutes">Cache TTL in minutes (5–60).</param>
/// <param name="DiscoveryLocationQuery">Optional ZIP code, city/state, or place query for discovery when no owned station coordinates exist.</param>
/// <param name="Municipality">Optional municipality or location for weather alert lookups.</param>
/// <param name="PinnedStations">Stations pinned to the dashboard. When null, existing pins are preserved.</param>
public sealed record UpdateNeighborConfigCommand(
    bool IsEnabled,
    IReadOnlyList<string>? EnabledStationMacAddresses,
    double RadiusMiles,
    double? ComparisonRadiusMiles,
    int MaxAgeMinutes,
    int MinStations,
    IReadOnlyList<string> EnabledProviders,
    int RefreshIntervalMinutes,
    string? DiscoveryLocationQuery = null,
    string? Municipality = null,
    IReadOnlyList<PinnedNeighborStation>? PinnedStations = null) : IRequest<NeighborConfigDto>;
