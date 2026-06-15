using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Application.Features.Dashboard.Commands;
using FluentValidation.TestHelper;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Dashboard;

public sealed class CustomLayoutItemValidatorTests
{
    private readonly CustomLayoutItemValidator _sut = new();

    private static CustomLayoutItemDto Ticker(string type = "header-ticker") => new()
    {
        Id = "ticker-1",
        Type = type,
        Size = "3x1",
        Position = string.Equals(type, "header-ticker", StringComparison.Ordinal) ? "header" : "footer",
        IsPaused = false,
    };

    // ── ChannelStationId ──────────────────────────────────────────────────────

    [Fact]
    public void NullChannelStationIdShouldPass()
    {
        var result = _sut.TestValidate(Ticker() with { ChannelStationId = null });
        result.ShouldNotHaveValidationErrorFor(i => i.ChannelStationId);
    }

    [Fact]
    public void ChannelStationIdAtMaxLengthShouldPass()
    {
        var result = _sut.TestValidate(Ticker() with { ChannelStationId = new string('a', 256) });
        result.ShouldNotHaveValidationErrorFor(i => i.ChannelStationId);
    }

    [Fact]
    public void ChannelStationIdExceedingMaxLengthShouldFail()
    {
        var result = _sut.TestValidate(Ticker() with { ChannelStationId = new string('a', 257) });
        result.ShouldHaveValidationErrorFor(i => i.ChannelStationId);
    }

    // ── AlertsZone ────────────────────────────────────────────────────────────

    [Fact]
    public void NullAlertsZoneShouldPass()
    {
        var result = _sut.TestValidate(Ticker() with { AlertsZone = null });
        result.ShouldNotHaveValidationErrorFor(i => i.AlertsZone);
    }

    [Theory]
    [InlineData("NYZ072")]
    [InlineData("TX")]
    [InlineData("NWS/HQ")]
    [InlineData("A1/B2")]
    public void ValidAlertsZoneFormatsShouldPass(string zone)
    {
        var result = _sut.TestValidate(Ticker() with { AlertsZone = zone });
        result.ShouldNotHaveValidationErrorFor(i => i.AlertsZone);
    }

    [Fact]
    public void AlertsZoneExceedingMaxLengthShouldFail()
    {
        var result = _sut.TestValidate(Ticker() with { AlertsZone = new string('A', 33) });
        result.ShouldHaveValidationErrorFor(i => i.AlertsZone);
    }

    [Theory]
    [InlineData("nyz072")]      // lowercase
    [InlineData("NY Z072")]     // space
    [InlineData("NY-Z072")]     // hyphen
    [InlineData("NY.Z072")]     // period
    public void AlertsZoneWithInvalidCharsShouldFail(string zone)
    {
        var result = _sut.TestValidate(Ticker() with { AlertsZone = zone });
        result.ShouldHaveValidationErrorFor(i => i.AlertsZone);
    }

    // ── Ticker rules still apply to footer-ticker ─────────────────────────────

    [Fact]
    public void FooterTickerWithChannelAndZoneShouldPass()
    {
        var item = Ticker("footer-ticker") with
        {
            ChannelStationId = "public:my-station",
            AlertsZone = "NYZ072",
        };
        var result = _sut.TestValidate(item);
        result.ShouldNotHaveAnyValidationErrors();
    }

    // ── Non-ticker items: new fields are ignored ──────────────────────────────

    [Fact]
    public void MetricBlockWithChannelAndZoneFieldsShouldNotValidateThem()
    {
        var item = new CustomLayoutItemDto
        {
            Id = "block-1",
            Type = "metric-block",
            Size = "1x1",
            DisplayMode = "rows",
            ChannelStationId = new string('x', 300),
            AlertsZone = "not/VALID-chars",
        };
        var result = _sut.TestValidate(item);
        // Validation rules for ChannelStationId/AlertsZone only fire inside AddTickerRules
        result.ShouldNotHaveValidationErrorFor(i => i.ChannelStationId);
        result.ShouldNotHaveValidationErrorFor(i => i.AlertsZone);
    }
}
