using AmbientWeather.Application.Features.Metrics.Queries;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Metrics;

/// <summary>
/// Tests for the static UTC-window helpers on <see cref="GetMetricHistoryQueryHandler"/>.
/// These are internal methods tested directly to avoid wiring up the full handler.
/// </summary>
public class GetMetricHistoryQueryHandlerTests
{
    // ─── ResolveDateRangeUtc ────────────────────────────────────────────────

    [Fact]
    public void ResolveDateRangeUtcWithUtcPreferenceShouldReturnMidnightToMidnightUtc()
    {
        var (from, to) = GetMetricHistoryQueryHandler.ResolveDateRangeUtc(
            "2026-06-03", "utc", stationTz: null);

        from.ShouldBe(new DateTime(2026, 6, 3, 0, 0, 0, DateTimeKind.Utc));
        to.ShouldBe(new DateTime(2026, 6, 3, 23, 59, 59, DateTimeKind.Utc).AddTicks(9999999));
    }

    [Fact]
    public void ResolveDateRangeUtcWithLocalPreferenceAndNoTimezoneShouldFallBackToUtc()
    {
        var (from, to) = GetMetricHistoryQueryHandler.ResolveDateRangeUtc(
            "2026-06-03", "local", stationTz: null);

        from.ShouldBe(new DateTime(2026, 6, 3, 0, 0, 0, DateTimeKind.Utc));
        to.ShouldBe(new DateTime(2026, 6, 3, 23, 59, 59, DateTimeKind.Utc).AddTicks(9999999));
    }

    [Fact]
    public void ResolveDateRangeUtcWithInvalidTimezoneShouldFallBackToUtc()
    {
        var (from, _) = GetMetricHistoryQueryHandler.ResolveDateRangeUtc(
            "2026-06-03", "local", stationTz: "Not/AReal/Timezone");

        from.ShouldBe(new DateTime(2026, 6, 3, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void ResolveDateRangeUtcWithAmericaChicagoTimezoneShouldShiftWindowByCdtOffset()
    {
        // America/Chicago in June is CDT = UTC-5.
        // Local midnight 2026-06-03 00:00 CDT = 2026-06-03 05:00 UTC.
        var (from, to) = GetMetricHistoryQueryHandler.ResolveDateRangeUtc(
            "2026-06-03", "local", stationTz: "America/Chicago");

        from.Kind.ShouldBe(DateTimeKind.Utc);
        from.ShouldBe(new DateTime(2026, 6, 3, 5, 0, 0, DateTimeKind.Utc));
        // to = local 2026-06-03 23:59:59.9999999 CDT = 2026-06-04 04:59:59.9999999 UTC
        to.ShouldBe(new DateTime(2026, 6, 4, 4, 59, 59, DateTimeKind.Utc).AddTicks(9999999));
    }

    // ─── ResolveUtcWindow preset ranges ────────────────────────────────────

    [Theory]
    [InlineData("24h")]
    [InlineData("7d")]
    [InlineData("30d")]
    [InlineData("90d")]
    [InlineData("1y")]
    public void ResolveUtcWindowWithPresetRangeShouldReturnWindowEndingAtNow(string range)
    {
        var before = DateTime.UtcNow;
        var q = new GetMetricHistoryQuery(
            MetricKey: "outdoor_temp", Range: range,
            DeviceId: null, From: null, To: null, Date: null, Granularity: null, Source: null);

        var (from, to) = GetMetricHistoryQueryHandler.ResolveUtcWindow(q);
        var after = DateTime.UtcNow;

        to.ShouldBeInRange(before, after);
        from.ShouldBeLessThan(to);
    }

    [Fact]
    public void ResolveUtcWindowWithDateRangeShouldApplyTimezonePreference()
    {
        var q = new GetMetricHistoryQuery(
            MetricKey: "outdoor_temp", Range: "date",
            DeviceId: null, From: null, To: null, Date: "2026-06-03", Granularity: null, Source: null);

        var (fromUtc, _) = GetMetricHistoryQueryHandler.ResolveUtcWindow(q, "local", "America/Chicago");

        // CDT is UTC-5 in June, so local midnight = 05:00 UTC.
        fromUtc.Hour.ShouldBe(5);
    }

    [Fact]
    public void ResolveUtcWindowWithCustomRangeShouldParseBoundaries()
    {
        var q = new GetMetricHistoryQuery(
            MetricKey: "outdoor_temp", Range: "custom",
            DeviceId: null, From: "2026-01-01T00:00:00Z", To: "2026-01-02T00:00:00Z",
            Date: null, Granularity: null, Source: null);

        var (from, to) = GetMetricHistoryQueryHandler.ResolveUtcWindow(q);

        from.ShouldBe(new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        to.ShouldBe(new DateTime(2026, 1, 2, 0, 0, 0, DateTimeKind.Utc));
    }

    // ─── ResolveGranularity ────────────────────────────────────────────────

    [Theory]
    [InlineData("raw", 1, "raw")]
    [InlineData("hour", 1, "hour")]
    [InlineData("day", 1, "day")]
    [InlineData(null, 24, "raw")]
    [InlineData("auto", 48, "raw")]
    [InlineData("auto", 49, "hour")]
    [InlineData("auto", 721, "day")]
    public void ResolveGranularityShouldReturnExpectedValue(string? requested, double hours, string expected)
    {
        var result = GetMetricHistoryQueryHandler.ResolveGranularity(requested, TimeSpan.FromHours(hours));
        result.ShouldBe(expected);
    }
}
