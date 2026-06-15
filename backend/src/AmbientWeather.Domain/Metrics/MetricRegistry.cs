namespace AmbientWeather.Domain.Metrics;

/// <summary>
/// Canonical registry of all supported displayable weather metrics.
/// Keyed by the stable metric key string (case-insensitive).
/// Add new metrics here and keep keys aligned with the frontend <c>METRIC_REGISTRY</c> in
/// <c>frontend/src/types/metrics.ts</c>.
/// </summary>
public static class MetricRegistry
{
    /// <summary>All registered metric definitions, keyed by metric key (case-insensitive).</summary>
    public static IReadOnlyDictionary<string, MetricDefinition> All { get; } =
        new Dictionary<string, MetricDefinition>(StringComparer.OrdinalIgnoreCase)
        {
            ["outdoor_temp"] = new(
                "outdoor_temp", "Outdoor Temperature", MetricCategory.Scalar,
                "tempf", MetricUnitFamily.Temperature, 1, RainfallAggregationMode.None, false, true),

            ["indoor_temp"] = new(
                "indoor_temp", "Indoor Temperature", MetricCategory.Scalar,
                "tempinf", MetricUnitFamily.Temperature, 1, RainfallAggregationMode.None, true, false),

            ["outdoor_humidity"] = new(
                "outdoor_humidity", "Outdoor Humidity", MetricCategory.Scalar,
                "humidity", MetricUnitFamily.Humidity, 0, RainfallAggregationMode.None, false, true),

            ["indoor_humidity"] = new(
                "indoor_humidity", "Indoor Humidity", MetricCategory.Scalar,
                "humidityin", MetricUnitFamily.Humidity, 0, RainfallAggregationMode.None, true, false),

            ["pressure"] = new(
                "pressure", "Barometric Pressure", MetricCategory.Scalar,
                "baromrelin", MetricUnitFamily.Pressure, 2, RainfallAggregationMode.None, false, false),

            ["uv_index"] = new(
                "uv_index", "UV Index", MetricCategory.Scalar,
                "uv", MetricUnitFamily.UvIndex, 0, RainfallAggregationMode.None, false, true),

            ["solar_radiation"] = new(
                "solar_radiation", "Solar Radiation", MetricCategory.Scalar,
                "solarradiation", MetricUnitFamily.SolarRadiation, 1, RainfallAggregationMode.None, false, true),

            ["wind_dir"] = new(
                "wind_dir", "Wind Direction", MetricCategory.Scalar,
                "winddir", MetricUnitFamily.WindDirection, 0, RainfallAggregationMode.None, false, true),

            ["wind_speed"] = new(
                "wind_speed", "Wind Speed", MetricCategory.Scalar,
                "windspeedmph", MetricUnitFamily.WindSpeed, 1, RainfallAggregationMode.None, false, true),

            ["wind_gust"] = new(
                "wind_gust", "Wind Gust", MetricCategory.Scalar,
                "windgustmph", MetricUnitFamily.WindSpeed, 1, RainfallAggregationMode.None, false, true),

            ["max_daily_gust"] = new(
                "max_daily_gust", "Max Daily Gust", MetricCategory.Scalar,
                "maxdailygust", MetricUnitFamily.WindSpeed, 1, RainfallAggregationMode.None, false, false),

            ["feels_like"] = new(
                "feels_like", "Outdoor Feels Like", MetricCategory.Scalar,
                "feelsLike", MetricUnitFamily.Temperature, 1, RainfallAggregationMode.None, false, true),

            ["indoor_feels_like"] = new(
                "indoor_feels_like", "Indoor Feels Like", MetricCategory.Scalar,
                "feelsLikein", MetricUnitFamily.Temperature, 1, RainfallAggregationMode.None, true, false),

            ["dew_point"] = new(
                "dew_point", "Outdoor Dew Point", MetricCategory.Scalar,
                "dewPoint", MetricUnitFamily.Temperature, 1, RainfallAggregationMode.None, false, true),

            ["indoor_dew_point"] = new(
                "indoor_dew_point", "Indoor Dew Point", MetricCategory.Scalar,
                "dewPointin", MetricUnitFamily.Temperature, 1, RainfallAggregationMode.None, true, false),


            ["rainfall_event"] = new(
                "rainfall_event", "Event Rainfall", MetricCategory.Rainfall,
                "eventrainin", MetricUnitFamily.Rainfall, 2, RainfallAggregationMode.Event, false, true),

            ["rainfall_day"] = new(
                "rainfall_day", "Daily Rainfall", MetricCategory.Rainfall,
                "dailyrainin", MetricUnitFamily.Rainfall, 2, RainfallAggregationMode.Daily, false, true),

            ["rainfall_week"] = new(
                "rainfall_week", "Weekly Rainfall", MetricCategory.Rainfall,
                "weeklyrainin", MetricUnitFamily.Rainfall, 2, RainfallAggregationMode.Weekly, false, true),

            ["rainfall_month"] = new(
                "rainfall_month", "Monthly Rainfall", MetricCategory.Rainfall,
                "monthlyrainin", MetricUnitFamily.Rainfall, 2, RainfallAggregationMode.Monthly, false, true),

            ["rainfall_year"] = new(
                "rainfall_year", "Annual Rainfall", MetricCategory.Rainfall,
                "yearlyrainin", MetricUnitFamily.Rainfall, 2, RainfallAggregationMode.Yearly, false, true),

            // ── Daily aggregate metrics (computed from stored WeatherReading history) ──
            ["daily_high_temp"] = new(
                "daily_high_temp", "Today Outdoor High", MetricCategory.Scalar,
                "", MetricUnitFamily.Temperature, 1, RainfallAggregationMode.None, false, false,
                IsAggregate: true),

            ["daily_low_temp"] = new(
                "daily_low_temp", "Today Outdoor Low", MetricCategory.Scalar,
                "", MetricUnitFamily.Temperature, 1, RainfallAggregationMode.None, false, false,
                IsAggregate: true),

            ["daily_high_temp_in"] = new(
                "daily_high_temp_in", "Today Indoor High", MetricCategory.Scalar,
                "", MetricUnitFamily.Temperature, 1, RainfallAggregationMode.None, true, false,
                IsAggregate: true),

            ["daily_low_temp_in"] = new(
                "daily_low_temp_in", "Today Indoor Low", MetricCategory.Scalar,
                "", MetricUnitFamily.Temperature, 1, RainfallAggregationMode.None, true, false,
                IsAggregate: true),
        };

    /// <summary>Returns <see langword="true"/> when <paramref name="key"/> is a registered metric key.</summary>
    public static bool IsSupported(string? key) => key is not null && All.ContainsKey(key);

    /// <summary>
    /// Tries to resolve a <see cref="MetricDefinition"/> for the given <paramref name="key"/>.
    /// </summary>
    /// <returns><see langword="true"/> when found; <see langword="false"/> otherwise.</returns>
    public static bool TryGet(
        string key,
        [System.Diagnostics.CodeAnalysis.NotNullWhen(true)] out MetricDefinition? definition) =>
        All.TryGetValue(key, out definition);
}
