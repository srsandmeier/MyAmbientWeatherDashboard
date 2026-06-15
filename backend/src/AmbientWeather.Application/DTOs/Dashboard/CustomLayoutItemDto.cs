namespace AmbientWeather.Application.DTOs.Dashboard;

/// <summary>
/// A single item in the settings-managed custom dashboard layout.
/// </summary>
public sealed record CustomLayoutItemDto
{
    /// <summary>Stable item identifier; unique within the custom layout.</summary>
    public required string Id { get; init; }

    /// <summary>Item type: metric-block, divider, header-ticker, or footer-ticker.</summary>
    public required string Type { get; init; }

    /// <summary>Optional user-facing item name.</summary>
    public string? Name { get; init; }

    /// <summary>Tile size in a 3-column grid, for example 1x1, 2x3, or 3x2.</summary>
    public required string Size { get; init; }

    /// <summary>Metric block display mode: rows or fill.</summary>
    public string? DisplayMode { get; init; }

    /// <summary>Optional icon name (Lucide icon identifier) for metric-block items.</summary>
    public string? Icon { get; init; }

    /// <summary>Icon position for metric-block items: <c>left</c> or <c>right</c> (default).</summary>
    public string? IconPosition { get; init; }

    /// <summary>Ordered metrics for a metric-block item.</summary>
    public IReadOnlyList<CustomMetricReferenceDto> Metrics { get; init; } = [];

    /// <summary>Ticker position: header or footer.</summary>
    public string? Position { get; init; }

    /// <summary>Ordered source labels for ticker items; concrete sources arrive in a later slice.</summary>
    public IReadOnlyList<string> SourceLabels { get; init; } = [];

    /// <summary>Whether ticker motion is currently paused.</summary>
    public bool IsPaused { get; init; } = true;

    /// <summary>
    /// Optional channel station id for ticker items. When set, the ticker displays data from
    /// the specified public or pinned station instead of the own-station reading.
    /// <c>null</c> means own station (default).
    /// </summary>
    public string? ChannelStationId { get; init; }

    /// <summary>
    /// Optional NWS area/zone/state code for ticker alert content. When set, alerts are
    /// fetched for this specific area code rather than the dashboard-level area selector.
    /// <c>null</c> means use the dashboard-level selection (default).
    /// </summary>
    public string? AlertsZone { get; init; }
}
