using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Ambient;
using AmbientWeather.Infrastructure.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Metrics;

public class AmbientHistoryServiceTests
{
    private static readonly string Mac = WeatherTestData.Mac;
    private const string ApiKey = "test-api-key";
    private const string AppKey = "test-app-key";
    private const string Subject = "auth0|test-user";

    private readonly Mock<IAmbientRestClient> _restClientMock = new();
    private readonly Mock<IDistributedCache> _cacheMock = new();
    private readonly Mock<IAmbientCredentialStore> _credentialStoreMock = new();

    private AmbientHistoryService CreateService() =>
        new(_restClientMock.Object, _cacheMock.Object, _credentialStoreMock.Object, NullLogger<AmbientHistoryService>.Instance);

    private void SetupCredentials() =>
        _credentialStoreMock
            .Setup(s => s.GetAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials(ApiKey, AppKey));

    // -----------------------------------------------------------------------
    // Cache behaviour
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetHistoryAsyncShouldCallAmbientAndCachePageOnCacheMiss()
    {
        var from = new DateTime(2026, 5, 28, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);

        SetupCacheMiss();
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([
                Reading(from.AddHours(1), 72.1),
                Reading(from.AddHours(2), 73.0),
            ]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, WeatherTestData.StationName, "outdoor_temp", from, to, "raw", "24h", Subject);

        result.Points.Count.ShouldBe(2);
        result.Points[0].Value.ShouldBe(72.1);
        result.Points[1].Value.ShouldBe(73.0);
        result.Unit.ShouldBe("F");
        result.DeviceName.ShouldBe(WeatherTestData.StationName);
        result.Granularity.ShouldBe("raw");
        _cacheMock.Verify(c => c.SetAsync(It.IsAny<string>(), It.IsAny<byte[]>(),
            It.IsAny<DistributedCacheEntryOptions>(), It.IsAny<CancellationToken>()), Times.AtLeastOnce);
    }

    [Fact]
    public async Task GetHistoryAsyncShouldSkipAmbientCallOnCacheHit()
    {
        var from = new DateTime(2026, 5, 28, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);

        var readings = new List<WeatherReadingDto> { Reading(from.AddHours(1), 70.0) };
        SetupCacheHit(System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(readings, AmbientJsonOptions.Default));
        SetupCredentials();

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "raw", "24h", Subject);

        result.Points.Count.ShouldBe(1);
        _restClientMock.Verify(
            c => c.GetDeviceHistoryAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<int>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetHistoryAsyncShouldEvictCorruptCacheEntryAndRefetch()
    {
        var from = new DateTime(2026, 5, 28, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);

        SetupCacheHit("not valid json"u8.ToArray());
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([
                Reading(from.AddHours(-1), 68.0),
                Reading(from.AddHours(1), 70.0),
            ]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "raw", "24h", Subject);

        result.Points.Count.ShouldBe(1);
        _cacheMock.Verify(c => c.RemoveAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        _restClientMock.Verify(
            c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()),
            Times.AtLeastOnce);
    }

    // -----------------------------------------------------------------------
    // Paging
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetHistoryAsyncShouldReturnEmptyWithWarningWhenFirstPageIsEmpty()
    {
        var from = new DateTime(2026, 5, 28, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);

        SetupCacheMiss();
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "raw", "24h", Subject);

        result.Points.ShouldBeEmpty();
        result.Warnings.ShouldContain(w => w.Contains("No data"));
    }

    [Fact]
    public async Task GetHistoryAsyncShouldDeduplicateReadingsByTimestamp()
    {
        var from = new DateTime(2026, 5, 28, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);
        var ts = from.AddHours(1);

        SetupCacheMiss();
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([Reading(ts, 72.0), Reading(ts, 99.9)]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "raw", "24h", Subject);

        result.Points.Count.ShouldBe(1);
    }

    [Fact]
    public async Task GetHistoryAsyncShouldTrimReadingsToRequestedWindow()
    {
        var from = new DateTime(2026, 5, 28, 6, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 28, 18, 0, 0, DateTimeKind.Utc);

        SetupCacheMiss();
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([
                Reading(from.AddHours(-2), 60.0),   // before from — excluded
                Reading(from.AddHours(1),  72.0),   // inside window
                Reading(from.AddHours(6),  74.0),   // inside window
                Reading(to.AddHours(2),    80.0),   // after to — excluded
            ]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "raw", "24h", Subject);

        result.Points.Count.ShouldBe(2);
    }

    [Fact]
    public async Task GetHistoryAsyncShouldPageBeyondFiftyPagesForLongRanges()
    {
        var from = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc);

        SetupCacheMiss();
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((
                string _,
                string _,
                string _,
                int _,
                DateTime? endDate,
                CancellationToken _) =>
            {
                var readingTime = endDate!.Value.AddDays(-1);
                return MakeResponse([Reading(readingTime, 70.0)]);
            });

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "day", "90d", Subject);

        result.Warnings.ShouldNotContain(w => w.Contains("page limit", StringComparison.OrdinalIgnoreCase));
        _restClientMock.Verify(
            c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()),
            Times.AtLeast(51));
    }

    // -----------------------------------------------------------------------
    // Aggregation
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetHistoryAsyncShouldAverageNonRainfallMetricsInHourBuckets()
    {
        var from = new DateTime(2026, 5, 28, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);

        SetupCacheMiss();
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([
                Reading(from.AddMinutes(10), 70.0),
                Reading(from.AddMinutes(20), 80.0),
                Reading(from.AddMinutes(70), 90.0),   // next hour bucket
            ]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "hour", "24h", Subject);

        // Hour 0: avg(70, 80) = 75; Hour 1: avg(90) = 90
        result.Points.Count.ShouldBe(2);
        result.Points[0].Value.ShouldBe(75.0);
        result.Points[1].Value.ShouldBe(90.0);
    }

    [Fact]
    public async Task GetHistoryAsyncShouldSumRainfallMetricsInHourBuckets()
    {
        var from = new DateTime(2026, 5, 28, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);

        SetupCacheMiss();
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([
                RainfallReading(from.AddMinutes(10), 0.02),
                RainfallReading(from.AddMinutes(20), 0.05),
            ]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "rainfall_day", from, to, "hour", "24h", Subject);

        result.Points.Count.ShouldBe(1);
        result.Points[0].Value!.Value.ShouldBe(0.07, tolerance: 1e-9);
    }

    [Fact]
    public async Task GetHistoryAsyncShouldGroupReadingsByUtcDayForDayGranularity()
    {
        var from = new DateTime(2026, 5, 27, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);

        SetupCacheMiss();
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([
                Reading(new DateTime(2026, 5, 27, 10, 0, 0, DateTimeKind.Utc), 68.0),
                Reading(new DateTime(2026, 5, 27, 20, 0, 0, DateTimeKind.Utc), 72.0),
                Reading(new DateTime(2026, 5, 28, 10, 0, 0, DateTimeKind.Utc), 74.0),
            ]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "day", "7d", Subject);

        // Day May 27: avg(68, 72) = 70; Day May 28: avg(74) = 74
        result.Points.Count.ShouldBe(2);
        result.Points[0].Value.ShouldBe(70.0);
        result.Points[1].Value.ShouldBe(74.0);
    }

    // -----------------------------------------------------------------------
    // Warning generation
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetHistoryAsyncShouldProduceMissingValuesWarningWhenSomeReadingsAreNull()
    {
        var from = new DateTime(2026, 5, 28, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);

        SetupCacheMiss();
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([
                Reading(from.AddHours(1), null),
                Reading(from.AddHours(2), 72.0),
            ]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "raw", "24h", Subject);

        result.Warnings.ShouldContain(w => w.Contains("missing values"));
    }

    [Fact]
    public async Task GetHistoryAsyncShouldReturnEmptySeriesWhenRawValuesAreAllNull()
    {
        var from = new DateTime(2026, 5, 28, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);

        SetupCacheMiss();
        SetupCredentials();
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([Reading(from.AddHours(1), null)]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "raw", "24h", Subject);

        result.Points.ShouldBeEmpty();
        result.Warnings.ShouldContain(w => w.Contains("No values"));
    }

    [Fact]
    public async Task GetHistoryAsyncShouldEmitWarningWhenTimestampsAreNotAdvancing()
    {
        var from = new DateTime(2026, 5, 27, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 5, 29, 0, 0, 0, DateTimeKind.Utc);
        var stuckTs = from.AddHours(12);

        SetupCacheMiss();
        SetupCredentials();
        // Always return the same oldest timestamp to trigger the stuck-loop guard on the second page.
        _restClientMock
            .Setup(c => c.GetDeviceHistoryAsync(Mac, ApiKey, AppKey, 288, It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeResponse([Reading(stuckTs, 72.0)]));

        var svc = CreateService();
        var result = await svc.GetHistoryAsync(
            Mac, null, "outdoor_temp", from, to, "raw", "7d", Subject);

        result.Warnings.ShouldContain(w => w.Contains("non-advancing", StringComparison.OrdinalIgnoreCase));
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private void SetupCacheMiss() =>
        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[]?)null);

    private void SetupCacheHit(byte[] data) =>
        _cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(data);

    private static DeviceHistoryResponseDto MakeResponse(IReadOnlyList<WeatherReadingDto> readings) =>
        new() { Readings = readings };

    private static WeatherReadingDto Reading(DateTime utc, double? tempF) => new()
    {
        DateUtc = new DateTimeOffset(utc).ToUnixTimeMilliseconds(),
        TempF = tempF,
    };

    private static WeatherReadingDto RainfallReading(DateTime utc, double? hourlyRainIn) => new()
    {
        DateUtc = new DateTimeOffset(utc).ToUnixTimeMilliseconds(),
        HourlyRainIn = hourlyRainIn,
    };
}
