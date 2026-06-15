using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Application.Features.Dashboard.Commands;
using FluentValidation.TestHelper;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Dashboard;

public sealed class SaveDashboardLayoutCommandValidatorTests
{
    private readonly SaveDashboardLayoutCommandValidator _sut = new();

    private static DashboardTileDto StatusTile(string id = "status") =>
        new() { I = id, X = 0, Y = 0, W = 2, H = 3, Type = "status" };

    private static DashboardTileDto MetricTile(string? id = null) =>
        new() { I = id ?? $"outdoor_temp-{WeatherTestData.Mac}", X = 0, Y = 0, W = 2, H = 3, Type = "metric", MetricKey = "outdoor_temp", DeviceId = WeatherTestData.Mac };

    private static DashboardTileDto RainfallTile(string id = "rainfall") =>
        new() { I = id, X = 0, Y = 3, W = 4, H = 3, Type = "rainfall" };

    private static DashboardTileDto GroupTile(string type, string id) =>
        new() { I = id, X = 0, Y = 0, W = 2, H = 3, Type = type, DeviceId = WeatherTestData.Mac };

    private static CustomLayoutItemDto MetricBlock(string id = "block-1") =>
        new()
        {
            Id = id,
            Type = "metric-block",
            Name = "Comfort",
            Size = "2x2",
            DisplayMode = "rows",
            Metrics =
            [
                new() { StationId = WeatherTestData.Mac, MetricKey = "outdoor_temp" },
            ],
        };

    private static CustomLayoutItemDto Divider(string id = "divider-1") =>
        new() { Id = id, Type = "divider", Size = "3x1" };

    private static CustomLayoutItemDto HeaderTicker(string id = "header-1") =>
        new() { Id = id, Type = "header-ticker", Size = "3x1", Position = "header", IsPaused = true };

    [Fact]
    public void ValidCommandWithAllTileTypesShouldPass()
    {
        var cmd = new SaveDashboardLayoutCommand([
            StatusTile(), MetricTile(), RainfallTile(),
            GroupTile("temperature", $"temperature-{WeatherTestData.Mac}"),
            GroupTile("humidity",    $"humidity-{WeatherTestData.Mac}"),
            GroupTile("wind",        $"wind-{WeatherTestData.Mac}"),
            GroupTile("solar",       $"solar-{WeatherTestData.Mac}"),
        ]);
        _sut.TestValidate(cmd).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void SolarGroupTileWithDeviceIdShouldPass()
    {
        var tile = GroupTile("solar", $"solar-{WeatherTestData.Mac}");
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void SolarGroupTileWithMetricKeyShouldFail()
    {
        var tile = new DashboardTileDto { I = $"solar-{WeatherTestData.Mac}", X = 0, Y = 0, W = 2, H = 3, Type = "solar", DeviceId = WeatherTestData.Mac, MetricKey = "solar_radiation" };
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void SolarGroupTileWithoutDeviceIdShouldFail()
    {
        var tile = new DashboardTileDto { I = $"solar-{WeatherTestData.Mac}", X = 0, Y = 0, W = 2, H = 3, Type = "solar" };
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void EmptyTileListShouldPass()
    {
        var cmd = new SaveDashboardLayoutCommand([]);
        _sut.TestValidate(cmd).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void TwentyOneTilesShouldFail()
    {
        var tiles = Enumerable.Range(0, 21).Select(i => StatusTile($"t{i}")).ToList();
        var cmd = new SaveDashboardLayoutCommand(tiles);
        _sut.TestValidate(cmd).ShouldHaveValidationErrorFor(c => c.Tiles);
    }

    [Fact]
    public void DuplicateTileIdsShouldFail()
    {
        var cmd = new SaveDashboardLayoutCommand([StatusTile("dup"), StatusTile("dup")]);
        _sut.TestValidate(cmd).ShouldHaveValidationErrorFor(c => c.Tiles);
    }

    [Fact]
    public void EmptyTileIdShouldFail()
    {
        var tile = new DashboardTileDto { I = "", X = 0, Y = 0, W = 2, H = 3, Type = "status" };
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void ZeroWidthTileShouldFail()
    {
        var tile = new DashboardTileDto { I = "s", X = 0, Y = 0, W = 0, H = 3, Type = "status" };
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void ZeroHeightTileShouldFail()
    {
        var tile = new DashboardTileDto { I = "s", X = 0, Y = 0, W = 2, H = 0, Type = "status" };
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void InvalidTypeShouldFail()
    {
        var tile = new DashboardTileDto { I = "s", X = 0, Y = 0, W = 2, H = 3, Type = "unknown" };
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void MetricTileWithoutMetricKeyShouldFail()
    {
        var tile = new DashboardTileDto { I = "m", X = 0, Y = 0, W = 2, H = 3, Type = "metric", DeviceId = WeatherTestData.Mac };
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void MetricTileWithUnknownMetricKeyShouldFail()
    {
        var tile = new DashboardTileDto { I = "m", X = 0, Y = 0, W = 2, H = 3, Type = "metric", MetricKey = "not_a_metric", DeviceId = WeatherTestData.Mac };
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void MetricTileWithoutDeviceIdShouldFail()
    {
        var tile = new DashboardTileDto { I = "m", X = 0, Y = 0, W = 2, H = 3, Type = "metric", MetricKey = "outdoor_temp" };
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void NonMetricTileWithMetricKeyShouldFail()
    {
        var tile = new DashboardTileDto { I = "r", X = 0, Y = 0, W = 4, H = 3, Type = "rainfall", MetricKey = "outdoor_temp" };
        _sut.TestValidate(new SaveDashboardLayoutCommand([tile])).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void CustomLayoutWithValidItemsShouldPass()
    {
        var cmd = new SaveDashboardLayoutCommand
        {
            LayoutMode = "custom",
            CustomItems = [MetricBlock(), Divider(), HeaderTicker()],
        };

        _sut.TestValidate(cmd).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void InvalidLayoutModeShouldFail()
    {
        var cmd = new SaveDashboardLayoutCommand { LayoutMode = "bespoke" };

        _sut.TestValidate(cmd).ShouldHaveValidationErrorFor(c => c.LayoutMode);
    }

    [Fact]
    public void ThirteenCustomItemsShouldFail()
    {
        var cmd = new SaveDashboardLayoutCommand
        {
            LayoutMode = "custom",
            CustomItems = Enumerable.Range(0, 13).Select(i => Divider($"divider-{i}")).ToList(),
        };

        _sut.TestValidate(cmd).ShouldHaveValidationErrorFor(c => c.CustomItems);
    }

    [Fact]
    public void DuplicateCustomItemIdsShouldFail()
    {
        var cmd = new SaveDashboardLayoutCommand
        {
            LayoutMode = "custom",
            CustomItems = [Divider("dup"), MetricBlock("dup")],
        };

        _sut.TestValidate(cmd).ShouldHaveValidationErrorFor(c => c.CustomItems);
    }

    [Fact]
    public void CustomItemWithInvalidSizeShouldFail()
    {
        var item = Divider() with { Size = "4x1" };
        var cmd = new SaveDashboardLayoutCommand { LayoutMode = "custom", CustomItems = [item] };

        _sut.TestValidate(cmd).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void CustomMetricWithUnknownMetricKeyShouldFail()
    {
        var item = MetricBlock() with
        {
            Metrics =
            [
                new() { StationId = WeatherTestData.Mac, MetricKey = "not_a_metric" },
            ],
        };
        var cmd = new SaveDashboardLayoutCommand { LayoutMode = "custom", CustomItems = [item] };

        _sut.TestValidate(cmd).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void CustomMetricWithoutStationShouldFail()
    {
        var item = MetricBlock() with
        {
            Metrics =
            [
                new() { StationId = "", MetricKey = "outdoor_temp" },
            ],
        };
        var cmd = new SaveDashboardLayoutCommand { LayoutMode = "custom", CustomItems = [item] };

        _sut.TestValidate(cmd).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void FillModeWithMetricsExceedingCapacityShouldFail()
    {
        // 1x1 block (capacity 1) with 2 metrics exceeds the fill capacity.
        var item = MetricBlock() with
        {
            Size = "1x1",
            DisplayMode = "fill",
            Metrics =
            [
                new() { StationId = WeatherTestData.Mac, MetricKey = "outdoor_temp" },
                new() { StationId = WeatherTestData.Mac, MetricKey = "indoor_temp" },
            ],
        };
        var cmd = new SaveDashboardLayoutCommand { LayoutMode = "custom", CustomItems = [item] };

        _sut.TestValidate(cmd).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void FillModeWithMultipleMetricsWithinCapacityShouldPass()
    {
        // 2x2 block (capacity 4) with 2 metrics is within range.
        var item = MetricBlock() with
        {
            Size = "2x2",
            DisplayMode = "fill",
            Metrics =
            [
                new() { StationId = WeatherTestData.Mac, MetricKey = "outdoor_temp" },
                new() { StationId = WeatherTestData.Mac, MetricKey = "indoor_temp" },
            ],
        };
        var cmd = new SaveDashboardLayoutCommand { LayoutMode = "custom", CustomItems = [item] };

        _sut.TestValidate(cmd).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void FillModeWithNoMetricsShouldFail()
    {
        var item = MetricBlock() with { DisplayMode = "fill", Metrics = [] };
        var cmd = new SaveDashboardLayoutCommand { LayoutMode = "custom", CustomItems = [item] };

        _sut.TestValidate(cmd).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void HeaderTickerWithFooterPositionShouldFail()
    {
        var item = HeaderTicker() with { Position = "footer" };
        var cmd = new SaveDashboardLayoutCommand { LayoutMode = "custom", CustomItems = [item] };

        _sut.TestValidate(cmd).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void NullTileTypeShouldReturnValidationErrorNotThrow()
    {
        // When Type is null the When-predicate guard must not throw NullReferenceException.
        // FluentValidation does not short-circuit When predicates based on sibling rule results,
        // so the guard must use a null-safe form (e.g. "metric".Equals(t.Type, ...)).
        var tile = new DashboardTileDto { I = "t", X = 0, Y = 0, W = 2, H = 3, Type = null! };
        var result = _sut.TestValidate(new SaveDashboardLayoutCommand([tile]));
        result.IsValid.ShouldBeFalse();
        result.ShouldHaveValidationErrorFor("Tiles[0].Type");
    }
}
