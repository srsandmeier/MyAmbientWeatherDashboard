using AmbientWeather.Application.Features.Metrics;
using AmbientWeather.Domain.Metrics;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Domain.Metrics;

public sealed class MetricRegistryTests
{
    private static readonly string[] ExpectedKeys =
    [
        "outdoor_temp", "indoor_temp",
        "outdoor_humidity", "indoor_humidity",
        "pressure", "uv_index", "solar_radiation",
        "wind_dir", "wind_speed", "wind_gust", "max_daily_gust",
        "feels_like", "indoor_feels_like",
        "dew_point", "indoor_dew_point",
        "rainfall_event", "rainfall_day", "rainfall_week", "rainfall_month", "rainfall_year",
        "daily_high_temp", "daily_low_temp", "daily_high_temp_in", "daily_low_temp_in",
    ];

    [Fact]
    public void AllShouldContainAllExpectedKeys()
    {
        MetricRegistry.All.Count.ShouldBe(ExpectedKeys.Length);
        foreach (var key in ExpectedKeys)
            MetricRegistry.All.ContainsKey(key).ShouldBeTrue($"key '{key}' missing from registry");
    }

    [Theory]
    [InlineData("outdoor_temp")]
    [InlineData("OUTDOOR_TEMP")]
    [InlineData("Outdoor_Temp")]
    public void IsSupportedShouldBeCaseInsensitive(string key)
    {
        MetricRegistry.IsSupported(key).ShouldBeTrue();
    }

    [Fact]
    public void IsSupportedShouldReturnFalseForUnknownKey()
    {
        MetricRegistry.IsSupported("not_a_metric").ShouldBeFalse();
        MetricRegistry.IsSupported(null).ShouldBeFalse();
        MetricRegistry.IsSupported(string.Empty).ShouldBeFalse();
    }

    [Fact]
    public void AllDefinitionsShouldHaveNonEmptyRequiredFields()
    {
        foreach (var (key, def) in MetricRegistry.All)
        {
            def.Key.ToLowerInvariant().ShouldBe(key.ToLowerInvariant(), $"definition key mismatch for '{key}'");
            def.Label.ShouldNotBeNullOrWhiteSpace($"label is empty for '{key}'");
            // Aggregate metrics are computed from history and have no Ambient API field.
            if (!def.IsAggregate)
                def.AmbientField.ShouldNotBeNullOrWhiteSpace($"AmbientField is empty for '{key}'");
            def.DisplayPrecision.ShouldBeGreaterThanOrEqualTo(0, $"invalid DisplayPrecision for '{key}'");
        }
    }

    [Theory]
    [InlineData("daily_high_temp")]
    [InlineData("daily_low_temp")]
    [InlineData("daily_high_temp_in")]
    [InlineData("daily_low_temp_in")]
    public void AggregateMetricsShouldBeMarkedAggregateWithTemperatureUnitFamily(string key)
    {
        var def = MetricRegistry.All[key];
        def.IsAggregate.ShouldBeTrue();
        def.UnitFamily.ShouldBe(MetricUnitFamily.Temperature);
        def.Category.ShouldBe(MetricCategory.Scalar);
        def.IsNeighbourEligible.ShouldBeFalse();
    }

    [Theory]
    [InlineData("rainfall_event")]
    [InlineData("rainfall_day")]
    [InlineData("rainfall_week")]
    [InlineData("rainfall_month")]
    [InlineData("rainfall_year")]
    public void RainfallKeysShouldHaveRainfallCategory(string key)
    {
        MetricRegistry.All[key].Category.ShouldBe(MetricCategory.Rainfall);
        MetricRegistry.All[key].RainfallAggregation.ShouldNotBe(RainfallAggregationMode.None);
    }

    [Theory]
    [InlineData("outdoor_temp")]
    [InlineData("indoor_temp")]
    [InlineData("outdoor_humidity")]
    [InlineData("indoor_humidity")]
    [InlineData("pressure")]
    [InlineData("uv_index")]
    [InlineData("solar_radiation")]
    [InlineData("wind_dir")]
    [InlineData("wind_speed")]
    public void ScalarKeysShouldHaveScalarCategoryAndNoRainfallAggregation(string key)
    {
        MetricRegistry.All[key].Category.ShouldBe(MetricCategory.Scalar);
        MetricRegistry.All[key].RainfallAggregation.ShouldBe(RainfallAggregationMode.None);
    }

    [Theory]
    [InlineData("indoor_temp")]
    [InlineData("indoor_humidity")]
    public void IndoorMetricsShouldBeMarkedIndoor(string key)
    {
        MetricRegistry.All[key].IsIndoor.ShouldBeTrue();
    }

    [Theory]
    [InlineData("outdoor_temp")]
    [InlineData("outdoor_humidity")]
    [InlineData("wind_speed")]
    [InlineData("rainfall_event")]
    public void OutdoorMetricsShouldNotBeMarkedIndoor(string key)
    {
        MetricRegistry.All[key].IsIndoor.ShouldBeFalse();
    }

    [Fact]
    public void TryGetShouldReturnDefinitionForKnownKey()
    {
        MetricRegistry.TryGet("outdoor_temp", out var def).ShouldBeTrue();
        def.ShouldNotBeNull();
        def!.Key.ShouldBe("outdoor_temp");
        def.UnitFamily.ShouldBe(MetricUnitFamily.Temperature);
    }

    [Fact]
    public void TryGetShouldReturnFalseForUnknownKey()
    {
        MetricRegistry.TryGet("unknown_key", out var def).ShouldBeFalse();
        def.ShouldBeNull();
    }

    [Fact]
    public void HistoryMetricMapKeysShouldMatchRegistry()
    {
        // Every key in HistoryMetricMap must exist in MetricRegistry so the two
        // sources never diverge silently.
        var historyKeys = HistoryMetricMap.SupportedKeys;
        foreach (var key in historyKeys)
            MetricRegistry.IsSupported(key).ShouldBeTrue($"HistoryMetricMap key '{key}' missing from MetricRegistry");
    }
}
