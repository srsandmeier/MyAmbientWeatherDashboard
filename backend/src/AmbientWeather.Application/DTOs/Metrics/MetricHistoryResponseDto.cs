namespace AmbientWeather.Application.DTOs.Metrics;

/// <summary>
/// Chart-ready history response for a single metric over a requested time window.
/// </summary>
public record MetricHistoryResponseDto
{
    /// <summary>Gets the metric key that was requested (e.g., <c>outdoor_temp</c>).</summary>
    public required string MetricKey { get; init; }

    /// <summary>Gets the normalized MAC address of the station that was queried.</summary>
    public required string DeviceId { get; init; }

    /// <summary>Gets the display name of the station, preferring nickname over provider name.</summary>
    public string? DeviceName { get; init; }

    /// <summary>Gets the range identifier as supplied in the request (e.g., <c>7d</c>, <c>date</c>).</summary>
    public required string Range { get; init; }

    /// <summary>Gets the inclusive UTC start of the returned data window.</summary>
    public required DateTime FromUtc { get; init; }

    /// <summary>Gets the inclusive UTC end of the returned data window.</summary>
    public required DateTime ToUtc { get; init; }

    /// <summary>Gets the applied granularity after resolving <c>auto</c>: <c>raw</c>, <c>hour</c>, or <c>day</c>.</summary>
    public required string Granularity { get; init; }

    /// <summary>Gets the unit label for the metric values (e.g., <c>F</c>, <c>mph</c>, <c>inHg</c>).</summary>
    public required string Unit { get; init; }

    /// <summary>Gets the time-series data points in ascending timestamp order.</summary>
    public required IReadOnlyList<MetricHistoryPointDto> Points { get; init; }

    /// <summary>Gets non-fatal warnings about data quality or coverage.</summary>
    public required IReadOnlyList<string> Warnings { get; init; }
}
