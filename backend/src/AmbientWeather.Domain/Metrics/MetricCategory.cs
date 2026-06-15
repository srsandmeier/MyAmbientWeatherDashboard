namespace AmbientWeather.Domain.Metrics;

/// <summary>Broad classification of a metric's measurement type.</summary>
public enum MetricCategory
{
    /// <summary>A single instantaneous measurement.</summary>
    Scalar,

    /// <summary>An accumulated precipitation value over a time period.</summary>
    Rainfall,
}
