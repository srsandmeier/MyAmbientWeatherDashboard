namespace AmbientWeather.Application.DTOs.Metrics;

/// <summary>
/// A single time-series point in a metric history response.
/// </summary>
public record MetricHistoryPointDto
{
    /// <summary>Gets the UTC timestamp of this reading.</summary>
    public required DateTime TimestampUtc { get; init; }

    /// <summary>Gets the metric value, or <see langword="null"/> when the sensor did not report a value.</summary>
    public double? Value { get; init; }
}
