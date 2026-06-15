using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Features.Dashboard.Queries;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Dashboard;

public class GetDashboardDailyExtremaQueryHandlerTests
{
    private const string Subject = "auth0|test-user";
    private static readonly string Mac = WeatherTestData.Mac;

    private readonly Mock<ICurrentUserService> _currentUserMock = new();
    private readonly Mock<IAmbientCredentialStore> _credStoreMock = new();
    private readonly Mock<IUserStationStore> _stationStoreMock = new();
    private readonly Mock<IUserPreferencesStore> _prefStoreMock = new();
    private readonly Mock<IWeatherReadingRepository> _repoMock = new();
    private readonly Mock<IAmbientRestClient> _restClientMock = new();

    private GetDashboardDailyExtremaQueryHandler CreateHandler() =>
        new(_currentUserMock.Object, _credStoreMock.Object, _stationStoreMock.Object,
            _prefStoreMock.Object, _repoMock.Object, _restClientMock.Object,
            NullLogger<GetDashboardDailyExtremaQueryHandler>.Instance);

    private void SetupUser()
    {
        _currentUserMock.Setup(s => s.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(s => s.AuthProviderSubject).Returns(Subject);
    }

    private void SetupCredentials() =>
        _credStoreMock.Setup(s => s.GetAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("key", "appkey"));

    private void SetupStation(string? nickname = null) =>
        _stationStoreMock.Setup(s => s.GetDefaultStationAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = Mac, Name = WeatherTestData.StationName, Nickname = nickname });

    private void SetupPrefs(string timezone = "local") =>
        _prefStoreMock.Setup(s => s.GetOrCreateAsync(Subject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences { DailyExtremaTimezone = timezone });

    private void SetupDbExtrema(double? highF, double? lowF, double? highInF, double? lowInF) =>
        _repoMock.Setup(r => r.GetDailyTempExtremaAsync(Mac, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((highF, lowF, highInF, lowInF));

    private void SetupRestHistory(params WeatherReadingDto[] readings) =>
        _restClientMock.Setup(r => r.GetDeviceHistoryAsync(
                Mac, It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DeviceHistoryResponseDto { Readings = readings, TotalReadings = readings.Length });

    [Fact]
    public async Task HandleShouldThrowWhenNoCredentials()
    {
        SetupUser();
        _credStoreMock.Setup(s => s.GetAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        await Should.ThrowAsync<AmbientCredentialsRequiredException>(
            () => CreateHandler().Handle(new GetDashboardDailyExtremaQuery(), CancellationToken.None));
    }

    [Fact]
    public async Task HandleShouldThrowWhenNoDefaultStation()
    {
        SetupUser();
        SetupCredentials();
        _stationStoreMock.Setup(s => s.GetDefaultStationAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        await Should.ThrowAsync<AmbientStationsRequiredException>(
            () => CreateHandler().Handle(new GetDashboardDailyExtremaQuery(), CancellationToken.None));
    }

    [Fact]
    public async Task HandleShouldReturnExtremaFromRepository()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();
        SetupPrefs();
        SetupDbExtrema(92.3, 68.1, 74.5, 65.0);

        var result = await CreateHandler().Handle(new GetDashboardDailyExtremaQuery(), CancellationToken.None);

        result.DeviceId.ShouldBe(Mac);
        result.DailyHighTempF.ShouldBe(92.3);
        result.DailyLowTempF.ShouldBe(68.1);
        result.DailyHighTempInF.ShouldBe(74.5);
        result.DailyLowTempInF.ShouldBe(65.0);
        result.DateUtc.ShouldBe(DateTime.UtcNow.Date, tolerance: TimeSpan.FromSeconds(5));
        // REST client should NOT be called when DB has data.
        _restClientMock.Verify(r => r.GetDeviceHistoryAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<int>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleShouldUseNicknameAsDeviceName()
    {
        SetupUser();
        SetupCredentials();
        SetupStation(nickname: WeatherTestData.Nickname);
        SetupPrefs();
        SetupDbExtrema(null, null, null, null);
        SetupRestHistory();

        var result = await CreateHandler().Handle(new GetDashboardDailyExtremaQuery(), CancellationToken.None);

        result.DeviceName.ShouldBe(WeatherTestData.Nickname);
    }

    [Fact]
    public async Task HandleShouldFallBackToRestWhenDbHasNoReadings()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();
        SetupPrefs();
        SetupDbExtrema(null, null, null, null);

        var todayMs = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero).ToUnixTimeMilliseconds();
        SetupRestHistory(
            new WeatherReadingDto { DateUtc = todayMs + 3_600_000, TempF = 88.0, TempInF = 72.0 },
            new WeatherReadingDto { DateUtc = todayMs + 7_200_000, TempF = 91.5, TempInF = 74.5 },
            new WeatherReadingDto { DateUtc = todayMs + 1_800_000, TempF = 70.0, TempInF = 70.0 });

        var result = await CreateHandler().Handle(new GetDashboardDailyExtremaQuery(), CancellationToken.None);

        result.DailyHighTempF.ShouldBe(91.5);
        result.DailyLowTempF.ShouldBe(70.0);
        result.DailyHighTempInF.ShouldBe(74.5);
        result.DailyLowTempInF.ShouldBe(70.0);
    }

    [Fact]
    public async Task HandleShouldFilterRestReadingsToTodayOnly()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();
        SetupPrefs();
        SetupDbExtrema(null, null, null, null);

        var todayMs = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero).ToUnixTimeMilliseconds();
        var yesterdayMs = todayMs - 3_600_000; // 1 hour before midnight = yesterday

        SetupRestHistory(
            new WeatherReadingDto { DateUtc = yesterdayMs, TempF = 999.0, TempInF = 999.0 }, // yesterday — excluded
            new WeatherReadingDto { DateUtc = todayMs + 3_600_000, TempF = 80.0, TempInF = 71.0 });

        var result = await CreateHandler().Handle(new GetDashboardDailyExtremaQuery(), CancellationToken.None);

        result.DailyHighTempF.ShouldBe(80.0);
        result.DailyLowTempF.ShouldBe(80.0);
    }

    [Fact]
    public async Task HandleShouldReturnNullsWhenRestAlsoHasNoData()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();
        SetupPrefs();
        SetupDbExtrema(null, null, null, null);
        SetupRestHistory(); // empty

        var result = await CreateHandler().Handle(new GetDashboardDailyExtremaQuery(), CancellationToken.None);

        result.DailyHighTempF.ShouldBeNull();
        result.DailyLowTempF.ShouldBeNull();
    }

    [Fact]
    public async Task HandleShouldReturnNullsWhenRestThrows()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();
        SetupPrefs();
        SetupDbExtrema(null, null, null, null);
        _restClientMock.Setup(r => r.GetDeviceHistoryAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("unavailable"));

        var result = await CreateHandler().Handle(new GetDashboardDailyExtremaQuery(), CancellationToken.None);

        result.DailyHighTempF.ShouldBeNull();
        result.DailyLowTempF.ShouldBeNull();
    }

    [Fact]
    public async Task HandleShouldPassTodayUtcToRepository()
    {
        SetupUser();
        SetupCredentials();
        SetupStation();
        SetupPrefs();
        SetupDbExtrema(85.0, 70.0, null, null);

        await CreateHandler().Handle(new GetDashboardDailyExtremaQuery(), CancellationToken.None);

        _repoMock.Verify(r => r.GetDailyTempExtremaAsync(
            Mac,
            It.Is<DateTime>(d => d.Date == DateTime.UtcNow.Date),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
