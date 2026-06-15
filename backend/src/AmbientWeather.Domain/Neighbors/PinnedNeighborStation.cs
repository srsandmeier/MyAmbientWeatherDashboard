namespace AmbientWeather.Domain.Neighbors;

/// <summary>
/// A specific nearby public station the user has pinned for display on the dashboard.
/// Stored as part of <see cref="NeighborConfig"/> in the <c>neighbor_config_json</c> column.
/// </summary>
/// <param name="Provider">Provider name: <c>AmbientOpen</c>, <c>WeatherGov</c>, or <c>OpenMeteo</c>.</param>
/// <param name="SourceId">Provider-assigned station identifier (MAC, NWS station ID, etc.).</param>
/// <param name="DisplayLabel">Optional user-facing label; falls back to the station's discovered name.</param>
/// <param name="SelectedMetricKeys">Optional selected metric keys; null means all provider-supported metrics.</param>
/// <param name="IsEnabled">Whether this pinned station should appear on the default dashboard.</param>
public sealed record PinnedNeighborStation(
    string Provider,
    string SourceId,
    string? DisplayLabel = null,
    IReadOnlyList<string>? SelectedMetricKeys = null,
    bool IsEnabled = true);
