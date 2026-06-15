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

public class GetCurrentReadingQueryHandlerTests
{
    private const string Subject = "auth0|test-user";
    private static readonly string Mac = WeatherTestData.Mac;
    private const string ApiKey = "api-key";
    private const string AppKey = "app-key";

    private readonly Mock<ICurrentUserService> _currentUserMock = new();
    private readonly Mock<IAmbientCredentialStore> _credStoreMock = new();
    private readonly Mock<IUserStationStore> _stationStoreMock = new();
    private readonly Mock<ILatestReadingCache> _cacheMock = new();
    private readonly Mock<IAmbientRestClient> _restClientMock = new();

    private GetCurrentReadingQueryHandler CreateHandler() =>
        new(_currentUserMock.Object, _credStoreMock.Object, _stationStoreMock.Object,
            _cacheMock.Object, _restClientMock.Object);

    private void SetupAuthenticatedUser(string subject = Subject)
    {
        _currentUserMock.Setup(s => s.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(s => s.AuthProviderSubject).Returns(subject);
    }

    private void SetupCredentials(string apiKey = ApiKey, string appKey = AppKey)
    {
        _credStoreMock
            .Setup(s => s.GetAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials(apiKey, appKey));
    }

    private void SetupStation(string? mac = null, string? name = null, string? nickname = null)
    {
        _stationStoreMock
            .Setup(s => s.GetDefaultStationAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation
            {
                MacAddress = mac ?? Mac,
                Name = name ?? WeatherTestData.StationName,
                Nickname = nickname,
            });
    }

    private static DeviceDto MakeDeviceDto(string? mac = null, double tempF = 72.4) => new()
    {
        MacAddress = mac ?? Mac,
        Info = new DeviceInfoDto { Name = WeatherTestData.StationName },
        LastData = new DeviceDataDto { DateUtc = 1_700_000_000_000L, TempF = tempF },
    };

    private static DeviceHistoryResponseDto MakeHistory(double tempF = 71.8) => new()
    {
        Readings =
        [
            new WeatherReadingDto
            {
                DateUtc = 1_700_000_300_000L,
                TempF = tempF,
                Humidity = 52,
            },
        ],
        TotalReadings = 1,
    };

    // -----------------------------------------------------------------------
    // 428 — missing credentials or station
    // -----------------------------------------------------------------------

    [Fact]
    public async Task HandleShouldThrow428WhenNoCredentials()
    {
        SetupAuthenticatedUser();
        _credStoreMock
            .Setup(s => s.GetAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        var handler = CreateHandler();
        await Should.ThrowAsync<AmbientCredentialsRequiredException>(
            () => handler.Handle(new GetCurrentReadingQuery(), CancellationToken.None));
    }

    [Fact]
    public async Task HandleShouldThrowAmbientStationsRequiredWhenNoDefaultStation()
    {
        SetupAuthenticatedUser();
        SetupCredentials();
        _stationStoreMock
            .Setup(s => s.GetDefaultStationAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        var handler = CreateHandler();
        await Should.ThrowAsync<AmbientStationsRequiredException>(
            () => handler.Handle(new GetCurrentReadingQuery(), CancellationToken.None));
    }

    // -----------------------------------------------------------------------
    // Cache hit — no REST call made
    // -----------------------------------------------------------------------

    [Fact]
    public async Task HandleShouldReturnCachedReadingWithoutCallingRestApi()
    {
        SetupAuthenticatedUser();
        SetupCredentials();
        SetupStation();

        var cached = new CurrentReadingDto
        {
            DeviceId = Mac,
            TimestampUtc = DateTime.UtcNow,
            ReceivedAtUtc = DateTime.UtcNow,
            TempF = 65.0,
        };

        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cached);

        var result = await CreateHandler().Handle(new GetCurrentReadingQuery(), CancellationToken.None);

        result.TempF.ShouldBe(65.0);
        _restClientMock.Verify(
            r => r.GetDevicesAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task HandleShouldFallBackToRestWhenCachedReadingHasNoSensorValues()
    {
        SetupAuthenticatedUser();
        SetupCredentials();
        SetupStation();

        var emptyCached = new CurrentReadingDto
        {
            DeviceId = Mac,
            DeviceName = WeatherTestData.StationName,
            TimestampUtc = DateTime.UtcNow,
            ReceivedAtUtc = DateTime.UtcNow,
        };

        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync(emptyCached);

        _restClientMock
            .Setup(r => r.GetDevicesAsync(ApiKey, AppKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeDeviceDto(tempF: 73.2)]);

        var result = await CreateHandler().Handle(new GetCurrentReadingQuery(), CancellationToken.None);

        result.TempF.ShouldBe(73.2);
        _restClientMock.Verify(
            r => r.GetDevicesAsync(ApiKey, AppKey, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // -----------------------------------------------------------------------
    // Cache miss — falls back to REST API
    // -----------------------------------------------------------------------

    [Fact]
    public async Task HandleShouldCallRestApiOnCacheMiss()
    {
        SetupAuthenticatedUser();
        SetupCredentials();
        SetupStation();

        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        _restClientMock
            .Setup(r => r.GetDevicesAsync(ApiKey, AppKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeDeviceDto()]);

        var result = await CreateHandler().Handle(new GetCurrentReadingQuery(), CancellationToken.None);

        result.TempF.ShouldBe(72.4);
        result.DeviceId.ShouldBe(Mac);
    }

    [Fact]
    public async Task HandleShouldMatchDeviceMacAddressAcrossSupportedFormats()
    {
        SetupAuthenticatedUser();
        SetupCredentials();
        SetupStation(mac: WeatherTestData.Mac);

        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), WeatherTestData.Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        _restClientMock
            .Setup(r => r.GetDevicesAsync(ApiKey, AppKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeDeviceDto(mac: WeatherTestData.ColonMac, tempF: 74.0)]);

        var result = await CreateHandler().Handle(new GetCurrentReadingQuery(), CancellationToken.None);

        result.TempF.ShouldBe(74.0);
    }

    [Fact]
    public async Task HandleShouldCacheResultAfterRestApiFallback()
    {
        SetupAuthenticatedUser();
        SetupCredentials();
        SetupStation();

        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        _restClientMock
            .Setup(r => r.GetDevicesAsync(ApiKey, AppKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeDeviceDto()]);

        await CreateHandler().Handle(new GetCurrentReadingQuery(), CancellationToken.None);

        _cacheMock.Verify(
            c => c.SetAsync(
                It.IsAny<string>(), Mac, It.IsAny<CurrentReadingDto>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task HandleShouldFallBackToHistoryWhenDeviceDataHasNoSensorValues()
    {
        SetupAuthenticatedUser();
        SetupCredentials();
        SetupStation();

        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        _restClientMock
            .Setup(r => r.GetDevicesAsync(ApiKey, AppKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync([new DeviceDto
            {
                MacAddress = WeatherTestData.ColonMac,
                Info = new DeviceInfoDto { Name = WeatherTestData.StationName },
                LastData = new DeviceDataDto { DateUtc = 1_700_000_000_000L },
            }]);

        _restClientMock
            .Setup(r => r.GetDeviceHistoryAsync(WeatherTestData.ColonMac, ApiKey, AppKey, 1, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeHistory(tempF: 69.5));

        var result = await CreateHandler().Handle(new GetCurrentReadingQuery(), CancellationToken.None);

        result.TempF.ShouldBe(69.5);
        result.Humidity.ShouldBe(52);
    }

    [Fact]
    public async Task HandleShouldCacheHistoryFallbackReading()
    {
        SetupAuthenticatedUser();
        SetupCredentials();
        SetupStation();

        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        _restClientMock
            .Setup(r => r.GetDevicesAsync(ApiKey, AppKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        _restClientMock
            .Setup(r => r.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 1, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeHistory(tempF: 70.1));

        await CreateHandler().Handle(new GetCurrentReadingQuery(), CancellationToken.None);

        _cacheMock.Verify(
            c => c.SetAsync(
                It.IsAny<string>(),
                Mac,
                It.Is<CurrentReadingDto>(reading => reading.TempF == 70.1),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task HandleShouldUseCorrectApiKeysForRestCall()
    {
        SetupAuthenticatedUser();
        SetupCredentials(apiKey: "my-api-key", appKey: "my-app-key");
        SetupStation();

        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        _restClientMock
            .Setup(r => r.GetDevicesAsync("my-api-key", "my-app-key", It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeDeviceDto()]);

        await CreateHandler().Handle(new GetCurrentReadingQuery(), CancellationToken.None);

        _restClientMock.Verify(
            r => r.GetDevicesAsync("my-api-key", "my-app-key", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // -----------------------------------------------------------------------
    // Offline station — station in DB not returned by API
    // -----------------------------------------------------------------------

    [Fact]
    public async Task HandleShouldReturnOfflineShellWhenStationNotInApiResponse()
    {
        SetupAuthenticatedUser();
        SetupCredentials();
        SetupStation(mac: Mac, name: WeatherTestData.StationName, nickname: WeatherTestData.Nickname);

        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), Mac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CurrentReadingDto?)null);

        // API returns an empty list — station not visible.
        _restClientMock
            .Setup(r => r.GetDevicesAsync(ApiKey, AppKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await CreateHandler().Handle(new GetCurrentReadingQuery(), CancellationToken.None);

        result.DeviceId.ShouldBe(Mac);
        result.DeviceName.ShouldBe(WeatherTestData.Nickname); // Nickname wins over name.
        result.TempF.ShouldBeNull();              // No sensor data.
    }
}
