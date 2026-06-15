namespace AmbientWeather.Application.DTOs.Dashboard;

/// <summary>
/// A metric selected into a custom dashboard block.
/// </summary>
public sealed record CustomMetricReferenceDto
{
    /// <summary>Normalized or raw station MAC/device identifier. Accepted as display configuration; not validated against the user's owned stations at save or read time.</summary>
    public required string StationId { get; init; }

    /// <summary>Shared metric registry key.</summary>
    public required string MetricKey { get; init; }

    /// <summary>Optional user-facing label override for the metric row.</summary>
    public string? LabelOverride { get; init; }
}
