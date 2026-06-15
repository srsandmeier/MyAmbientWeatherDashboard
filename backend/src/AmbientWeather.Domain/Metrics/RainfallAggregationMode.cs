namespace AmbientWeather.Domain.Metrics;

/// <summary>
/// Identifies the accumulation window for a rainfall metric's snapshot value.
/// </summary>
public enum RainfallAggregationMode
{
    /// <summary>Not a rainfall metric.</summary>
    None,

    /// <summary>Last rain event total.</summary>
    Event,

    /// <summary>Rolling 24-hour accumulation.</summary>
    Daily,

    /// <summary>Rolling 7-day accumulation.</summary>
    Weekly,

    /// <summary>Rolling 30-day accumulation.</summary>
    Monthly,

    /// <summary>Year-to-date accumulation.</summary>
    Yearly,
}
