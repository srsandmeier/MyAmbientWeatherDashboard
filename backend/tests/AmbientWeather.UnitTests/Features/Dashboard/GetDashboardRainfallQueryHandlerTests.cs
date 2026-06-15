using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Features.Dashboard.Queries;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Dashboard;

public class GetDashboardRainfallQueryHandlerTests
{
    private const string Subject = "auth0|test-user";
    private static readonly string Mac = WeatherTestData.Mac;

    private readonly Mock<ICurrentUserService> _currentUserMock = new();
    private readonly Mock<IAmbientCredentialStore> _credStoreMock = new();
    private readonly Mock<IUserStationStore> _stationStoreMock = new();
    private readonly Mock<ILatestReadingCache> _cacheMock = new();
    private readonly Mock<IAmbientRestClient> _restClientMock = new();

    private GetDashboardRainfallQueryHandler CreateHandler() =>
        new(_currentUserMock.Object, _credStoreMock.Object, _stationStoreMock.Object,
            _cacheMock.Object, _restClientMock.Object);

    private void SetupUser()
    {
        _currentUserMock.Setup(s => s.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(s => s.AuthProviderSubject).Returns(Subject);
    }

    private void SetupCredentials() =>
        _credStoreMock.Setup(s => s.GetAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("key", "appkey"));

    private void SetupStation() =>
        _stationStoreMock.Setup(s => s.GetDefaultStationAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = Mac, Name = WeatherTestData.StationName });

    private static DeviceHistoryResponseDto MakeHistory(double dailyRainIn = 0.65) => new()
    {
        Readings =
        [
            new WeatherReadingDto
            {
                DateUtc = 1_700_000_300_000L,
                DailyRainIn = dailyRainIn,
                WeeklyRainIn = 2.25,
            },
        ],
        TotalReadings = 1,
    };

    [Fact]
    public async Task HandleShouldThrowWhenNoCredentials()
    {
        SetupUser();
        _credStoreMock.Setup(s => s.GetAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        await Should.ThrowAsync<AmbientCredentialsRequiredException>(
            () => CreateHandler().Handle(new GetDashboardRainfallQuery(), CancellationToken.None));
    }

    [Fact]
    public async Task HandleShouldThrowWhenNoDefaultStation()
    {
        SetupUser();
        SetupCredentials();
        _stationStoreMock.Setup(s => s.GetDefaultStationAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        await Should.ThrowAsync<AmbientStationsRequiredException>(
            () => CreateHandler().Handle(new GetDashboardRainfallQuery(), CancellationToken.None));
    }

    [Fact]
    public async Task HandleShouldReturnRainfallFieldsFromCache()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();

        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CurrentReadingDto
            {
                DeviceId = Mac,
                DeviceName = WeatherTestData.StationName,
                TimestampUtc = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc),
                ReceivedAtUtc = new DateTime(2026, 6, 1, 12, 0, 1, DateTimeKind.Utc),
                DailyRainIn = 0.25,
                WeeklyRainIn = 1.50,
                MonthlyRainIn = 3.00,
                YearlyRainIn = 12.75,
            });

        var result = await CreateHandler().Handle(new GetDashboardRainfallQuery(), CancellationToken.None);

        result.DeviceId.ShouldBe(Mac);
        result.DailyRainIn.ShouldBe(0.25);
        result.WeeklyRainIn.ShouldBe(1.50);
        result.MonthlyRainIn.ShouldBe(3.00);
        result.YearlyRainIn.ShouldBe(12.75);
        _restClientMock.Verify(r => r.GetDevicesAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleShouldFallBackToRestWhenCachedReadingHasNoSensorValues()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();

        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CurrentReadingDto
            {
                DeviceId = Mac,
                DeviceName = WeatherTestData.StationName,
                TimestampUtc = DateTime.UtcNow,
                ReceivedAtUtc = DateTime.UtcNow,
            });

        _restClientMock.Setup(r => r.GetDevicesAsync("key", "appkey", It.IsAny<CancellationToken>()))
            .ReturnsAsync([new DeviceDto
            {
                MacAddress = Mac,
                Info = new DeviceInfoDto { Name = WeatherTestData.StationName },
                LastData = new DeviceDataDto { DateUtc = 1_700_000_000_000L, DailyRainIn = 0.75 },
            }]);

        var result = await CreateHandler().Handle(new GetDashboardRainfallQuery(), CancellationToken.None);

        result.DailyRainIn.ShouldBe(0.75);
        _restClientMock.Verify(r => r.GetDevicesAsync("key", "appkey", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleShouldFallBackToRestOnCacheMiss()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();

        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        _restClientMock.Setup(r => r.GetDevicesAsync("key", "appkey", It.IsAny<CancellationToken>()))
            .ReturnsAsync([new DeviceDto
            {
                MacAddress = Mac,
                Info = new DeviceInfoDto { Name = WeatherTestData.StationName },
                LastData = new DeviceDataDto { DateUtc = 1_700_000_000_000L, DailyRainIn = 0.5 },
            }]);

        var result = await CreateHandler().Handle(new GetDashboardRainfallQuery(), CancellationToken.None);

        result.DailyRainIn.ShouldBe(0.5);
        _restClientMock.Verify(r => r.GetDevicesAsync("key", "appkey", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleShouldFallBackToHistoryWhenDeviceDataHasNoSensorValues()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();

        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        _restClientMock.Setup(r => r.GetDevicesAsync("key", "appkey", It.IsAny<CancellationToken>()))
            .ReturnsAsync([new DeviceDto
            {
                MacAddress = WeatherTestData.ColonMac,
                Info = new DeviceInfoDto { Name = WeatherTestData.StationName },
                LastData = new DeviceDataDto { DateUtc = 1_700_000_000_000L },
            }]);

        _restClientMock.Setup(r => r.GetDeviceHistoryAsync(WeatherTestData.ColonMac, "key", "appkey", 1, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeHistory(dailyRainIn: 0.85));

        var result = await CreateHandler().Handle(new GetDashboardRainfallQuery(), CancellationToken.None);

        result.DailyRainIn.ShouldBe(0.85);
        result.WeeklyRainIn.ShouldBe(2.25);
    }

    [Fact]
    public async Task HandleShouldCacheHistoryFallbackReading()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();

        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        _restClientMock.Setup(r => r.GetDevicesAsync("key", "appkey", It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        _restClientMock.Setup(r => r.GetDeviceHistoryAsync(Mac, "key", "appkey", 1, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeHistory(dailyRainIn: 0.9));

        await CreateHandler().Handle(new GetDashboardRainfallQuery(), CancellationToken.None);

        _cacheMock.Verify(
            c => c.SetAsync(
                It.IsAny<string>(),
                Mac,
                It.Is<CurrentReadingDto>(reading => reading.DailyRainIn == 0.9),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task HandleShouldReturnOfflineShellWhenStationNotInApiResponse()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();

        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);
        _restClientMock.Setup(r => r.GetDevicesAsync("key", "appkey", It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await CreateHandler().Handle(new GetDashboardRainfallQuery(), CancellationToken.None);

        result.DeviceId.ShouldBe(Mac);
        result.DailyRainIn.ShouldBeNull();
    }
}
