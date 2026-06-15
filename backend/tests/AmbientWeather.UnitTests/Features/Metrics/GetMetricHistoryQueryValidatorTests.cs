using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.Features.Metrics.Queries;
using FluentValidation.TestHelper;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.Metrics;

public class GetMetricHistoryQueryValidatorTests
{
    private readonly GetMetricHistoryQueryValidator _validator = new();

    // -----------------------------------------------------------------------
    // Happy paths
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("outdoor_temp", "24h")]
    [InlineData("indoor_temp", "7d")]
    [InlineData("pressure", "30d")]
    [InlineData("wind_speed", "90d")]
    [InlineData("rainfall_day", "1y")]
    public void ValidMetricKeyAndPresetRangeShouldPassValidation(string metricKey, string range)
    {
        var q = Build(metricKey, range);
        _validator.TestValidate(q).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void ValidCustomRangeShouldPassValidation()
    {
        var q = Build("outdoor_temp", "custom",
            from: "2026-01-01T00:00:00Z",
            to: "2026-01-07T00:00:00Z");
        _validator.TestValidate(q).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void ValidDateModeShouldPassValidation()
    {
        var q = Build("outdoor_temp", "date", date: "2026-05-29");
        _validator.TestValidate(q).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void ValidMacDeviceIdShouldPassValidation()
    {
        var q = Build("outdoor_temp", "24h", deviceId: WeatherTestData.ColonMac);
        _validator.TestValidate(q).ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("raw")]
    [InlineData("hour")]
    [InlineData("day")]
    [InlineData("auto")]
    [InlineData(null)]
    public void ValidGranularityShouldPassValidation(string? granularity)
    {
        var q = Build("outdoor_temp", "24h", granularity: granularity);
        _validator.TestValidate(q).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void SourceMyShouldPassValidation()
    {
        var q = Build("outdoor_temp", "24h", source: "my");
        _validator.TestValidate(q).ShouldNotHaveAnyValidationErrors();
    }

    // -----------------------------------------------------------------------
    // MetricKey failures
    // -----------------------------------------------------------------------

    [Fact]
    public void EmptyMetricKeyShouldFailValidation()
    {
        var q = Build(string.Empty, "24h");
        _validator.TestValidate(q).ShouldHaveValidationErrorFor(x => x.MetricKey);
    }

    [Fact]
    public void UnknownMetricKeyShouldFailValidation()
    {
        var q = Build("unknown_metric", "24h");
        _validator.TestValidate(q).ShouldHaveValidationErrorFor(x => x.MetricKey);
    }

    [Theory]
    [InlineData("daily_high_temp")]
    [InlineData("nws_sky_conditions")]
    public void MetricWithoutHistorySelectorShouldFailValidation(string metricKey)
    {
        var q = Build(metricKey, "24h");
        _validator.TestValidate(q).ShouldHaveValidationErrorFor(x => x.MetricKey);
    }

    // -----------------------------------------------------------------------
    // Range failures
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("1h")]
    [InlineData("yesterday")]
    [InlineData("")]
    public void InvalidRangeShouldFailValidation(string range)
    {
        var q = Build("outdoor_temp", range);
        _validator.TestValidate(q).ShouldHaveValidationErrorFor(x => x.Range);
    }

    // -----------------------------------------------------------------------
    // Custom range failures
    // -----------------------------------------------------------------------

    [Fact]
    public void CustomRangeMissingFromShouldFailValidation()
    {
        var q = Build("outdoor_temp", "custom", to: "2026-01-07T00:00:00Z");
        _validator.TestValidate(q).ShouldHaveValidationErrorFor(x => x.From);
    }

    [Fact]
    public void CustomRangeMissingToShouldFailValidation()
    {
        var q = Build("outdoor_temp", "custom", from: "2026-01-01T00:00:00Z");
        _validator.TestValidate(q).ShouldHaveValidationErrorFor(x => x.To);
    }

    [Fact]
    public void CustomRangeFromAfterToShouldFailValidation()
    {
        var q = Build("outdoor_temp", "custom",
            from: "2026-01-07T00:00:00Z",
            to: "2026-01-01T00:00:00Z");
        _validator.TestValidate(q).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void CustomRangeExceedingMaxSpanShouldFailValidation()
    {
        var q = Build("outdoor_temp", "custom",
            from: "2020-01-01T00:00:00Z",
            to: "2026-01-01T00:00:00Z");
        _validator.TestValidate(q).IsValid.ShouldBeFalse();
    }

    // -----------------------------------------------------------------------
    // Date mode failures
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("05/29/2026")]
    [InlineData("2026-5-1")]
    [InlineData("not-a-date")]
    [InlineData("")]
    public void DateModeInvalidDateFormatShouldFailValidation(string date)
    {
        var q = Build("outdoor_temp", "date", date: date);
        _validator.TestValidate(q).ShouldHaveValidationErrorFor(x => x.Date);
    }

    // -----------------------------------------------------------------------
    // Device ID failures
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("not-a-mac")]
    [InlineData("00:11:22")]
    public void InvalidDeviceIdShouldFailValidation(string deviceId)
    {
        var q = Build("outdoor_temp", "24h", deviceId: deviceId);
        _validator.TestValidate(q).ShouldHaveValidationErrorFor(x => x.DeviceId);
    }

    // -----------------------------------------------------------------------
    // Source failures
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("neighbours")]
    [InlineData("public")]
    public void UnsupportedSourceShouldFailValidation(string source)
    {
        var q = Build("outdoor_temp", "24h", source: source);
        _validator.TestValidate(q).ShouldHaveValidationErrorFor(x => x.Source);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static GetMetricHistoryQuery Build(
        string metricKey,
        string range,
        string? deviceId = null,
        string? from = null,
        string? to = null,
        string? date = null,
        string? granularity = null,
        string? source = null) =>
        new(metricKey, range, deviceId, from, to, date, granularity, source);
}
