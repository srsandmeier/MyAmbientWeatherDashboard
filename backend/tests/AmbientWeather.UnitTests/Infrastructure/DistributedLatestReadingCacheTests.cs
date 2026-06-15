using AmbientWeather.UnitTests.TestData;
using System.Text.Json;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Infrastructure.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Infrastructure;

public class DistributedLatestReadingCacheTests
{
    private const string UserHash = "abc123";
    private static readonly string Mac = WeatherTestData.Mac;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static DistributedLatestReadingCache CreateCache(IDistributedCache inner) =>
        new(inner, NullLogger<DistributedLatestReadingCache>.Instance);

    private static CurrentReadingDto SampleReading() => new()
    {
        DeviceId = Mac,
        DeviceName = WeatherTestData.StationName,
        TimestampUtc = new DateTime(2026, 5, 31, 12, 0, 0, DateTimeKind.Utc),
        ReceivedAtUtc = new DateTime(2026, 5, 31, 12, 0, 1, DateTimeKind.Utc),
        TempF = 72.4,
        Humidity = 62,
    };

    // -----------------------------------------------------------------------
    // GetAsync
    // -----------------------------------------------------------------------

    [Fact]
    public async Task GetAsyncShouldReturnNullWhenKeyAbsent()
    {
        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((byte[]?)null);

        var result = await CreateCache(cacheMock.Object).GetAsync(UserHash, Mac);

        result.ShouldBeNull();
    }

    [Fact]
    public async Task GetAsyncShouldDeserializeStoredReading()
    {
        var reading = SampleReading();
        var json = JsonSerializer.Serialize(reading, JsonOptions);
        var bytes = System.Text.Encoding.UTF8.GetBytes(json);

        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(bytes);

        var result = await CreateCache(cacheMock.Object).GetAsync(UserHash, Mac);

        result.ShouldNotBeNull();
        result!.TempF.ShouldBe(72.4);
        result.Humidity.ShouldBe(62);
        result.DeviceId.ShouldBe(Mac);
    }

    [Fact]
    public async Task GetAsyncShouldReturnNullAndEvictCorruptEntry()
    {
        var bytes = "not valid json"u8.ToArray();
        string? removedKey = null;

        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(bytes);
        cacheMock
            .Setup(c => c.RemoveAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, CancellationToken>((key, _) => removedKey = key)
            .Returns(Task.CompletedTask);

        // Should not throw — corrupt entries are logged, evicted, and return null.
        var result = await CreateCache(cacheMock.Object).GetAsync(UserHash, Mac);

        result.ShouldBeNull();
        removedKey.ShouldBe($"latest-reading:{UserHash}:{Mac}");
    }

    [Fact]
    public async Task GetAsyncShouldReturnNullWhenCacheThrows()
    {
        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Redis unavailable"));

        var result = await CreateCache(cacheMock.Object).GetAsync(UserHash, Mac);

        result.ShouldBeNull();
    }

    // -----------------------------------------------------------------------
    // SetAsync
    // -----------------------------------------------------------------------

    [Fact]
    public async Task SetAsyncShouldSerializeAndStoreReading()
    {
        byte[]? captured = null;
        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.SetAsync(
                It.IsAny<string>(),
                It.IsAny<byte[]>(),
                It.IsAny<DistributedCacheEntryOptions>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, byte[], DistributedCacheEntryOptions, CancellationToken>(
                (_, bytes, _, _) => captured = bytes)
            .Returns(Task.CompletedTask);

        await CreateCache(cacheMock.Object).SetAsync(UserHash, Mac, SampleReading());

        captured.ShouldNotBeNull();
        var deserialized = JsonSerializer.Deserialize<CurrentReadingDto>(captured!, JsonOptions);
        deserialized!.TempF.ShouldBe(72.4);
    }

    [Fact]
    public async Task SetAsyncShouldUseFiveMinuteTtl()
    {
        DistributedCacheEntryOptions? capturedOptions = null;
        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.SetAsync(
                It.IsAny<string>(),
                It.IsAny<byte[]>(),
                It.IsAny<DistributedCacheEntryOptions>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, byte[], DistributedCacheEntryOptions, CancellationToken>(
                (_, _, opts, _) => capturedOptions = opts)
            .Returns(Task.CompletedTask);

        await CreateCache(cacheMock.Object).SetAsync(UserHash, Mac, SampleReading());

        capturedOptions!.AbsoluteExpirationRelativeToNow.ShouldBe(TimeSpan.FromMinutes(5));
    }

    [Fact]
    public async Task SetAsyncShouldNotThrowWhenCacheFails()
    {
        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.SetAsync(
                It.IsAny<string>(), It.IsAny<byte[]>(),
                It.IsAny<DistributedCacheEntryOptions>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Redis unavailable"));

        var ex = await Record.ExceptionAsync(() =>
            CreateCache(cacheMock.Object).SetAsync(UserHash, Mac, SampleReading()));

        ex.ShouldBeNull();
    }

    // -----------------------------------------------------------------------
    // RemoveAsync
    // -----------------------------------------------------------------------

    [Fact]
    public async Task RemoveAsyncShouldCallCacheRemove()
    {
        string? capturedKey = null;
        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.RemoveAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, CancellationToken>((key, _) => capturedKey = key)
            .Returns(Task.CompletedTask);

        await CreateCache(cacheMock.Object).RemoveAsync(UserHash, Mac);

        capturedKey.ShouldBe($"latest-reading:{UserHash}:{Mac}");
    }

    [Fact]
    public async Task RemoveAsyncShouldNotThrowWhenCacheFails()
    {
        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.RemoveAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Redis unavailable"));

        var ex = await Record.ExceptionAsync(() =>
            CreateCache(cacheMock.Object).RemoveAsync(UserHash, Mac));

        ex.ShouldBeNull();
    }

    // -----------------------------------------------------------------------
    // Key format
    // -----------------------------------------------------------------------

    [Fact]
    public async Task SetAsyncShouldUseCorrectCacheKey()
    {
        string? capturedKey = null;
        var cacheMock = new Mock<IDistributedCache>();
        cacheMock
            .Setup(c => c.SetAsync(
                It.IsAny<string>(), It.IsAny<byte[]>(),
                It.IsAny<DistributedCacheEntryOptions>(), It.IsAny<CancellationToken>()))
            .Callback<string, byte[], DistributedCacheEntryOptions, CancellationToken>(
                (key, _, _, _) => capturedKey = key)
            .Returns(Task.CompletedTask);

        await CreateCache(cacheMock.Object).SetAsync("hash42", "FFEEDDCCBBAA", SampleReading());

        capturedKey.ShouldBe("latest-reading:hash42:FFEEDDCCBBAA");
    }
}
