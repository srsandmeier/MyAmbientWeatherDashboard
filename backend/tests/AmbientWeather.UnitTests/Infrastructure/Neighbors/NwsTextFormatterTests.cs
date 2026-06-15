using AmbientWeather.Infrastructure.Neighbors;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Infrastructure.Neighbors;

/// <summary>
/// Unit tests for <see cref="NwsTextFormatter"/> — cloud layer formatting and
/// present weather concatenation.
/// </summary>
public sealed class NwsTextFormatterTests
{
    // ── FormatCloudLayers ────────────────────────────────────────────────────

    [Fact]
    public void FormatCloudLayersWithNullInputReturnsNull()
    {
        NwsTextFormatter.FormatCloudLayers(null).ShouldBeNull();
    }

    [Fact]
    public void FormatCloudLayersWithEmptyListReturnsNull()
    {
        NwsTextFormatter.FormatCloudLayers([]).ShouldBeNull();
    }

    [Fact]
    public void FormatCloudLayersWithSingleLayerFormatsCorrectly()
    {
        // 549 m × 3.28084 ≈ 1801 ft → rounded to nearest 100 → 1,800
        var layers = new[] { Layer("few", 549.0) };
        NwsTextFormatter.FormatCloudLayers(layers).ShouldBe("FEW @ 1,800ft");
    }

    [Fact]
    public void FormatCloudLayersWithMultipleLayersJoinsWithComma()
    {
        // 549 m → ~1,800ft; 1524 m → ~5,000ft
        var layers = new[] { Layer("few", 549.0), Layer("overcast", 1524.0) };
        NwsTextFormatter.FormatCloudLayers(layers).ShouldBe("FEW @ 1,800ft, OVC @ 5,000ft");
    }

    [Fact]
    public void FormatCloudLayersWithClearSkyAbbreviatesCLR()
    {
        NwsTextFormatter.FormatCloudLayers([Layer("clear", null)]).ShouldBe("CLR");
    }

    [Fact]
    public void FormatCloudLayersWithLayerWithoutHeightOmitsFeetPart()
    {
        NwsTextFormatter.FormatCloudLayers([Layer("scattered", null)]).ShouldBe("SCT");
    }

    [Theory]
    [InlineData("few", "FEW")]
    [InlineData("scattered", "SCT")]
    [InlineData("broken", "BKN")]
    [InlineData("overcast", "OVC")]
    [InlineData("clear", "CLR")]
    [InlineData("sky_clear", "CLR")]
    [InlineData("obscured", "VV")]
    public void FormatCloudLayersWithKnownCoverageWordsAbbreviatesCorrectly(string input, string expected)
    {
        var result = NwsTextFormatter.FormatCloudLayers([Layer(input, null)]);
        result.ShouldBe(expected);
    }

    [Fact]
    public void FormatCloudLayersWithUnknownCoverageUpperCases()
    {
        NwsTextFormatter.FormatCloudLayers([Layer("vv+", null)]).ShouldBe("VV+");
    }

    [Fact]
    public void FormatCloudLayersWithAllNullCoverageReturnsNull()
    {
        var layers = new[]
        {
            new NwsResponseTypes.NwsCloudLayer(null, null),
            new NwsResponseTypes.NwsCloudLayer(null, null),
        };
        NwsTextFormatter.FormatCloudLayers(layers).ShouldBeNull();
    }

    // ── FormatPresentWeather ─────────────────────────────────────────────────

    [Fact]
    public void FormatPresentWeatherWithNullInputReturnsNull()
    {
        NwsTextFormatter.FormatPresentWeather(null).ShouldBeNull();
    }

    [Fact]
    public void FormatPresentWeatherWithEmptyListReturnsNull()
    {
        NwsTextFormatter.FormatPresentWeather([]).ShouldBeNull();
    }

    [Fact]
    public void FormatPresentWeatherWithSingleItemReturnsTrimmedString()
    {
        var items = new[] { Weather("Light Rain") };
        NwsTextFormatter.FormatPresentWeather(items).ShouldBe("Light Rain");
    }

    [Fact]
    public void FormatPresentWeatherWithMultipleItemsJoinsWithCommaSpace()
    {
        var items = new[] { Weather("Light Rain"), Weather("Mist") };
        NwsTextFormatter.FormatPresentWeather(items).ShouldBe("Light Rain, Mist");
    }

    [Fact]
    public void FormatPresentWeatherWithNullRawStringsReturnsNull()
    {
        var items = new[]
        {
            new NwsResponseTypes.NwsPresentWeatherItem(null),
            new NwsResponseTypes.NwsPresentWeatherItem(""),
        };
        NwsTextFormatter.FormatPresentWeather(items).ShouldBeNull();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static NwsResponseTypes.NwsCloudLayer Layer(string coverage, double? heightMeters) =>
        new(coverage, heightMeters.HasValue ? new NwsResponseTypes.NwsMeasurement(heightMeters) : null);

    private static NwsResponseTypes.NwsPresentWeatherItem Weather(string raw) => new(raw);
}
