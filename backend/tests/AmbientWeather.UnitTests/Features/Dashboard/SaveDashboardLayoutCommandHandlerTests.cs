using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Application.Features.Dashboard.Commands;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Dashboard;

public class SaveDashboardLayoutCommandHandlerTests
{
    private const string Subject = "auth0|test-user";
    private static readonly string Mac = WeatherTestData.Mac;

    private readonly Mock<ICurrentUserService> _currentUserMock = new();
    private readonly Mock<IDashboardLayoutStore> _layoutStoreMock = new();

    private SaveDashboardLayoutCommandHandler CreateHandler() =>
        new(_currentUserMock.Object, _layoutStoreMock.Object);

    private void SetupUser()
    {
        _currentUserMock.Setup(s => s.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(s => s.AuthProviderSubject).Returns(Subject);
    }

    private void SetupLayoutStore() =>
        _layoutStoreMock
            .Setup(s => s.UpsertActiveAsync(Subject, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = Guid.NewGuid(),
                Name = "Default",
                IsActive = true,
                LayoutJson = "[]",
                UpdatedAtUtc = DateTime.UtcNow,
            });

    [Fact]
    public async Task HandleShouldSaveLayoutWithNoMetricTiles()
    {
        SetupUser();
        SetupLayoutStore();

        var tiles = new List<DashboardTileDto>
        {
            new() { I = "status", X = 0, Y = 0, W = 2, H = 3, Type = "status" },
            new() { I = "rainfall", X = 2, Y = 0, W = 4, H = 3, Type = "rainfall" },
        };
        var cmd = new SaveDashboardLayoutCommand(tiles);

        var result = await CreateHandler().Handle(cmd, CancellationToken.None);

        result.Tiles.Count.ShouldBe(2);
        _layoutStoreMock.Verify(s => s.UpsertActiveAsync(Subject, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleShouldSaveLayoutWithMetricTile()
    {
        SetupUser();
        SetupLayoutStore();

        var tiles = new List<DashboardTileDto>
        {
            new() { I = $"outdoor_temp-{Mac}", X = 0, Y = 0, W = 2, H = 3, Type = "metric", MetricKey = "outdoor_temp", DeviceId = Mac },
        };
        var cmd = new SaveDashboardLayoutCommand(tiles);

        var result = await CreateHandler().Handle(cmd, CancellationToken.None);

        result.Tiles[0].MetricKey.ShouldBe("outdoor_temp");
    }

    [Fact]
    public async Task HandleShouldSaveCustomLayout()
    {
        SetupUser();
        SetupLayoutStore();

        var customItems = new List<CustomLayoutItemDto>
        {
            new()
            {
                Id = "block-1",
                Type = "metric-block",
                Name = "Comfort",
                Size = "2x2",
                DisplayMode = "fill",
                Metrics =
                [
                    new() { StationId = Mac, MetricKey = "outdoor_temp" },
                ],
            },
        };
        var cmd = new SaveDashboardLayoutCommand
        {
            LayoutMode = "custom",
            CustomItems = customItems,
        };

        var result = await CreateHandler().Handle(cmd, CancellationToken.None);

        result.LayoutMode.ShouldBe("custom");
        result.CustomItems.Count.ShouldBe(1);
        result.CustomItems[0].Type.ShouldBe("metric-block");
        _layoutStoreMock.Verify(s => s.UpsertActiveAsync(
            Subject,
            It.Is<string>(json => json.Contains("\"layoutMode\":\"custom\"", StringComparison.Ordinal)
                                  && json.Contains("\"customItems\"", StringComparison.Ordinal)),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleShouldSaveCustomLayoutWithUnknownStationId()
    {
        // Mock/preview stations are not in the DB; the layout is display config and must still save.
        SetupUser();
        SetupLayoutStore();

        var cmd = new SaveDashboardLayoutCommand
        {
            LayoutMode = "custom",
            CustomItems =
            [
                new()
                {
                    Id = "block-1",
                    Type = "metric-block",
                    Name = "Preview",
                    Size = "1x1",
                    DisplayMode = "rows",
                    Metrics =
                    [
                        new() { StationId = WeatherTestData.SourceId, MetricKey = "outdoor_temp" },
                    ],
                },
            ],
        };

        var result = await CreateHandler().Handle(cmd, CancellationToken.None);

        result.LayoutMode.ShouldBe("custom");
        result.CustomItems.Count.ShouldBe(1);
    }
}
