using AmbientWeather.UnitTests.TestData;
using System.Text.Json;
using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Application.Features.Dashboard.Queries;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Dashboard;

public class GetDashboardLayoutQueryHandlerTests
{
    private const string Subject = "auth0|test-user";
    private static readonly string Mac = WeatherTestData.Mac;

    private readonly Mock<ICurrentUserService> _currentUserMock = new();
    private readonly Mock<IDashboardLayoutStore> _layoutStoreMock = new();
    private readonly Mock<IUserStationStore> _stationStoreMock = new();

    private GetDashboardLayoutQueryHandler CreateHandler() =>
        new(_currentUserMock.Object, _layoutStoreMock.Object, _stationStoreMock.Object);

    private void SetupUser()
    {
        _currentUserMock.Setup(s => s.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(s => s.AuthProviderSubject).Returns(Subject);
    }

    private static readonly JsonSerializerOptions LayoutJsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private static string TilesJson(IReadOnlyList<DashboardTileDto> tiles) =>
        JsonSerializer.Serialize(tiles, LayoutJsonOptions);

    private static string PayloadJson(DashboardLayoutPayloadDto payload) =>
        JsonSerializer.Serialize(payload, LayoutJsonOptions);

    [Fact]
    public async Task HandleShouldReturnExistingActiveLayout()
    {
        SetupUser();
        var layoutId = Guid.NewGuid();
        var tiles = new List<DashboardTileDto>
        {
            new() { I = "status", X = 0, Y = 0, W = 2, H = 3, Type = "status" },
        };

        _layoutStoreMock.Setup(s => s.GetActiveAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = layoutId,
                Name = "My Layout",
                IsActive = true,
                LayoutJson = TilesJson(tiles),
                UpdatedAtUtc = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            });

        var result = await CreateHandler().Handle(new GetDashboardLayoutQuery(), CancellationToken.None);

        result.Id.ShouldBe(layoutId);
        result.Name.ShouldBe("My Layout");
        result.LayoutMode.ShouldBe("default");
        result.Tiles.Count.ShouldBe(1);
        result.Tiles[0].Type.ShouldBe("status");
        result.CustomItems.ShouldBeEmpty();
        _stationStoreMock.Verify(s => s.GetDefaultStationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleShouldReturnExistingCustomLayoutPayload()
    {
        SetupUser();
        var layoutId = Guid.NewGuid();
        var payload = new DashboardLayoutPayloadDto
        {
            LayoutMode = "custom",
            Tiles = [],
            CustomItems =
            [
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
            ],
        };

        _layoutStoreMock.Setup(s => s.GetActiveAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = layoutId,
                Name = "My Layout",
                IsActive = true,
                LayoutJson = PayloadJson(payload),
                UpdatedAtUtc = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            });

        var result = await CreateHandler().Handle(new GetDashboardLayoutQuery(), CancellationToken.None);

        result.Id.ShouldBe(layoutId);
        result.LayoutMode.ShouldBe("custom");
        result.Tiles.ShouldBeEmpty();
        result.CustomItems.Count.ShouldBe(1);
        result.CustomItems[0].Metrics[0].MetricKey.ShouldBe("outdoor_temp");
    }

    [Fact]
    public async Task HandleShouldSeedDefaultLayoutWhenNoneExists()
    {
        SetupUser();
        _layoutStoreMock.Setup(s => s.GetActiveAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((DashboardLayout?)null);

        _stationStoreMock.Setup(s => s.GetDefaultStationAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = Mac, Name = WeatherTestData.StationName });

        _layoutStoreMock.Setup(s => s.UpsertActiveAsync(Subject, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = Guid.NewGuid(),
                Name = "Default",
                IsActive = true,
                LayoutJson = "[]",
                UpdatedAtUtc = DateTime.UtcNow,
            });

        var result = await CreateHandler().Handle(new GetDashboardLayoutQuery(), CancellationToken.None);

        result.LayoutMode.ShouldBe("default");
        result.Tiles.ShouldNotBeEmpty();
        result.Tiles.ShouldContain(t => t.Type == "temperature");
        result.Tiles.ShouldContain(t => t.Type == "humidity");
        result.Tiles.ShouldContain(t => t.Type == "wind");
        result.Tiles.ShouldContain(t => t.Type == "solar");
        result.Tiles.ShouldContain(t => t.Type == "rainfall");
        _layoutStoreMock.Verify(s => s.UpsertActiveAsync(Subject, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleShouldSeedMinimalLayoutWhenNoStation()
    {
        SetupUser();
        _layoutStoreMock.Setup(s => s.GetActiveAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((DashboardLayout?)null);
        _stationStoreMock.Setup(s => s.GetDefaultStationAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);
        _layoutStoreMock.Setup(s => s.UpsertActiveAsync(Subject, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = Guid.NewGuid(),
                Name = "Default",
                IsActive = true,
                LayoutJson = "[]",
                UpdatedAtUtc = DateTime.UtcNow,
            });

        var result = await CreateHandler().Handle(new GetDashboardLayoutQuery(), CancellationToken.None);

        result.LayoutMode.ShouldBe("default");
        result.Tiles.ShouldContain(t => t.Type == "rainfall");
        result.Tiles.ShouldNotContain(t => t.Type == "metric");
    }

    [Fact]
    public async Task HandleShouldReseedDefaultWhenStoredJsonIsMalformed()
    {
        // If the stored layout_json is invalid JSON, the handler must not throw —
        // it should fall through to the reseed path and return a working default layout.
        SetupUser();
        _layoutStoreMock.Setup(s => s.GetActiveAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = Guid.NewGuid(),
                Name = "Corrupt",
                IsActive = true,
                LayoutJson = "{ this is not valid json",
                UpdatedAtUtc = DateTime.UtcNow,
            });
        _stationStoreMock.Setup(s => s.GetDefaultStationAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);
        _layoutStoreMock.Setup(s => s.UpsertActiveAsync(Subject, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = Guid.NewGuid(),
                Name = "Default",
                IsActive = true,
                LayoutJson = "[]",
                UpdatedAtUtc = DateTime.UtcNow,
            });

        var result = await CreateHandler().Handle(new GetDashboardLayoutQuery(), CancellationToken.None);

        result.LayoutMode.ShouldBe("default");
        _layoutStoreMock.Verify(s => s.UpsertActiveAsync(Subject, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleShouldCoalesceNullLayoutModeToDefault()
    {
        // A stored payload with an explicit null layoutMode must be returned as "default",
        // not as null which would cause the frontend to render nothing.
        SetupUser();
        var json = """{"layoutMode":null,"tiles":[],"customItems":[]}""";
        _layoutStoreMock.Setup(s => s.GetActiveAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardLayout
            {
                Id = Guid.NewGuid(),
                Name = "Stale",
                IsActive = true,
                LayoutJson = json,
                UpdatedAtUtc = DateTime.UtcNow,
            });

        var result = await CreateHandler().Handle(new GetDashboardLayoutQuery(), CancellationToken.None);

        result.LayoutMode.ShouldBe("default");
    }
}
