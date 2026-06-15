using AmbientWeather.Domain.Neighbors;

namespace AmbientWeather.Application.DTOs.Neighbors;

/// <summary>
/// A pinned neighbor station returned as part of <see cref="NeighborConfigDto"/>.
/// </summary>
public sealed record PinnedNeighborStationDto
{
    /// <summary>Provider name: <c>AmbientOpen</c>, <c>WeatherGov</c>, or <c>OpenMeteo</c>.</summary>
    public required string Provider { get; init; }

    /// <summary>Provider-assigned station identifier.</summary>
    public required string SourceId { get; init; }

    /// <summary>Optional user-facing label; null means use the station's discovered name.</summary>
    public string? DisplayLabel { get; init; }

    /// <summary>Optional selected metric keys; null means all provider-supported metrics.</summary>
    public IReadOnlyList<string>? SelectedMetricKeys { get; init; }

    /// <summary>Whether this pinned station should appear on the default dashboard.</summary>
    public bool IsEnabled { get; init; } = true;

    /// <summary>Maps a domain <see cref="PinnedNeighborStation"/> to its DTO.</summary>
    public static PinnedNeighborStationDto From(PinnedNeighborStation p) => new()
    {
        Provider = p.Provider,
        SourceId = p.SourceId,
        DisplayLabel = p.DisplayLabel,
        SelectedMetricKeys = p.SelectedMetricKeys,
        IsEnabled = p.IsEnabled,
    };
}
