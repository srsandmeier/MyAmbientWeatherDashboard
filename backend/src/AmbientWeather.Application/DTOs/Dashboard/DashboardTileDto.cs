namespace AmbientWeather.Application.DTOs.Dashboard;

/// <summary>
/// A single tile in the dashboard grid layout.
/// Compatible with react-grid-layout item fields plus Ambient-specific tile metadata.
/// </summary>
public sealed record DashboardTileDto
{
    /// <summary>Stable tile identifier; unique within a layout.</summary>
    public required string I { get; init; }

    /// <summary>Horizontal grid column (0-based).</summary>
    public required int X { get; init; }

    /// <summary>Vertical grid row (0-based).</summary>
    public required int Y { get; init; }

    /// <summary>Width in grid columns (1–12).</summary>
    public required int W { get; init; }

    /// <summary>Height in grid rows (≥ 1).</summary>
    public required int H { get; init; }

    /// <summary>Tile display type: <c>metric</c>, <c>temperature</c>, <c>humidity</c>, <c>wind</c>, <c>solar</c>, <c>conditions</c>, <c>rainfall</c>, or <c>status</c>.</summary>
    public required string Type { get; init; }

    /// <summary>Metric registry key for <c>type = metric</c> tiles; <see langword="null"/> otherwise.</summary>
    public string? MetricKey { get; init; }

    /// <summary>Normalized device MAC address for <c>type = metric</c> tiles; <see langword="null"/> otherwise.</summary>
    public string? DeviceId { get; init; }
}
