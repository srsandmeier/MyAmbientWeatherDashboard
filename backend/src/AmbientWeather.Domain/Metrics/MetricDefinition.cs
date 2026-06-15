namespace AmbientWeather.Domain.Metrics;

/// <summary>
/// Describes a displayable weather metric: identity, presentation, unit family,
/// rainfall accumulation mode, indoor/outdoor classification, and neighbour eligibility.
/// All instances live in <see cref="MetricRegistry.All"/>; do not construct ad-hoc instances outside tests.
/// </summary>
/// <param name="Key">Stable metric identifier (lower-snake-case), e.g. <c>outdoor_temp</c>.</param>
/// <param name="Label">User-facing display label.</param>
/// <param name="Category">Broad measurement classification.</param>
/// <param name="AmbientField">Primary Ambient API snapshot field name (lower-case), e.g. <c>tempf</c>.</param>
/// <param name="UnitFamily">Unit family used to select the user-preferred display unit.</param>
/// <param name="DisplayPrecision">Number of decimal places shown in the UI.</param>
/// <param name="RainfallAggregation">
/// Accumulation window for rainfall metrics;
/// <see cref="RainfallAggregationMode.None"/> for non-rainfall metrics.
/// </param>
/// <param name="IsIndoor">True when the metric measures an indoor sensor.</param>
/// <param name="IsNeighbourEligible">True when the metric can be compared across neighbour stations.</param>
/// <param name="IsAggregate">
/// True when the metric value is computed from stored history (e.g. daily high/low) rather than
/// read from the live current-reading snapshot. Aggregate metrics are served by
/// <c>GET /api/dashboard/daily-extremes</c> rather than <c>GET /api/dashboard/current</c>.
/// </param>
public sealed record MetricDefinition(
    string Key,
    string Label,
    MetricCategory Category,
    string AmbientField,
    MetricUnitFamily UnitFamily,
    int DisplayPrecision,
    RainfallAggregationMode RainfallAggregation,
    bool IsIndoor,
    bool IsNeighbourEligible,
    bool IsAggregate = false);
