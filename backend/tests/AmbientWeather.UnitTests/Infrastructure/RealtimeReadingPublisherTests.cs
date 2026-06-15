using AmbientWeather.UnitTests.TestData;
using System.Text.Json;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using StackExchange.Redis;
using Xunit;

namespace AmbientWeather.UnitTests.Infrastructure;

public class RealtimeReadingPublisherTests
{
    private const string UserHash = "abc123";
    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web);

    private static CurrentReadingDto SampleReading() => new()
    {
        DeviceId = WeatherTestData.Mac,
        TimestampUtc = DateTime.UtcNow,
        ReceivedAtUtc = DateTime.UtcNow,
        TempF = 70.0,
    };

    // -----------------------------------------------------------------------
    // RedisRealtimeReadingPublisher
    // -----------------------------------------------------------------------

    [Fact]
    public async Task RedisPublisherShouldUpdateCacheBeforePublishing()
    {
        var cacheMock = new Mock<ILatestReadingCache>();
        var subscriberMock = new Mock<ISubscriber>();
        var multiplexerMock = new Mock<IConnectionMultiplexer>();
        multiplexerMock.Setup(m => m.GetSubscriber(It.IsAny<object?>()))
            .Returns(subscriberMock.Object);

        var publisher = new RedisRealtimeReadingPublisher(
            cacheMock.Object, multiplexerMock.Object,
            NullLogger<RedisRealtimeReadingPublisher>.Instance);

        var reading = SampleReading();
        await publisher.PublishAsync(UserHash, reading);

        cacheMock.Verify(
            c => c.SetAsync(UserHash, reading.DeviceId, reading, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RedisPublisherShouldPublishToCorrectChannel()
    {
        var cacheMock = new Mock<ILatestReadingCache>();
        RedisChannel capturedChannel = default;
        var subscriberMock = new Mock<ISubscriber>();
        subscriberMock
            .Setup(s => s.PublishAsync(
                It.IsAny<RedisChannel>(),
                It.IsAny<RedisValue>(),
                It.IsAny<CommandFlags>()))
            .Callback<RedisChannel, RedisValue, CommandFlags>((ch, _, _) => capturedChannel = ch)
            .ReturnsAsync(1L);

        var multiplexerMock = new Mock<IConnectionMultiplexer>();
        multiplexerMock.Setup(m => m.GetSubscriber(It.IsAny<object?>()))
            .Returns(subscriberMock.Object);

        var publisher = new RedisRealtimeReadingPublisher(
            cacheMock.Object, multiplexerMock.Object,
            NullLogger<RedisRealtimeReadingPublisher>.Instance);

        await publisher.PublishAsync(UserHash, SampleReading());

        capturedChannel.ToString().ShouldBe($"ambient:readings:{UserHash}");
    }

    [Fact]
    public async Task RedisPublisherShouldNotThrowWhenPubSubFails()
    {
        var cacheMock = new Mock<ILatestReadingCache>();
        var subscriberMock = new Mock<ISubscriber>();
        subscriberMock
            .Setup(s => s.PublishAsync(
                It.IsAny<RedisChannel>(), It.IsAny<RedisValue>(), It.IsAny<CommandFlags>()))
            .ThrowsAsync(new RedisException("Connection lost"));

        var multiplexerMock = new Mock<IConnectionMultiplexer>();
        multiplexerMock.Setup(m => m.GetSubscriber(It.IsAny<object?>()))
            .Returns(subscriberMock.Object);

        var publisher = new RedisRealtimeReadingPublisher(
            cacheMock.Object, multiplexerMock.Object,
            NullLogger<RedisRealtimeReadingPublisher>.Instance);

        // Cache is still updated even when pub/sub fails
        var ex = await Record.ExceptionAsync(() =>
            publisher.PublishAsync(UserHash, SampleReading()));

        ex.ShouldBeNull();
        cacheMock.Verify(
            c => c.SetAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<CurrentReadingDto>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // -----------------------------------------------------------------------
    // LocalRealtimeReadingPublisher
    // -----------------------------------------------------------------------

    [Fact]
    public async Task LocalPublisherShouldUpdateCacheOnly()
    {
        var cacheMock = new Mock<ILatestReadingCache>();

        var publisher = new LocalRealtimeReadingPublisher(cacheMock.Object);
        var reading = SampleReading();
        await publisher.PublishAsync(UserHash, reading);

        cacheMock.Verify(
            c => c.SetAsync(UserHash, reading.DeviceId, reading, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // -----------------------------------------------------------------------
    // RedisRealtimeReadingSubscriber
    // -----------------------------------------------------------------------

    [Fact]
    public async Task RedisSubscriberShouldDeserializeAndPushMessage()
    {
        var pusherMock = new Mock<IWeatherHubPusher>();
        var subscriber = new RedisRealtimeReadingSubscriber(
            Mock.Of<IConnectionMultiplexer>(),
            pusherMock.Object,
            NullLogger<RedisRealtimeReadingSubscriber>.Instance);

        var payload = JsonSerializer.Serialize(
            new ReadingUpdatedEventDto { Reading = SampleReading() },
            JsonSerializerOptions);

        await subscriber.ProcessMessageAsync(UserHash, payload);

        pusherMock.Verify(
            p => p.SendReadingUpdatedAsync(
                UserHash,
                It.Is<ReadingUpdatedEventDto>(dto => dto.Reading.DeviceId == WeatherTestData.Mac),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task RedisSubscriberShouldIgnoreBadJson()
    {
        var pusherMock = new Mock<IWeatherHubPusher>();
        var subscriber = new RedisRealtimeReadingSubscriber(
            Mock.Of<IConnectionMultiplexer>(),
            pusherMock.Object,
            NullLogger<RedisRealtimeReadingSubscriber>.Instance);

        var ex = await Record.ExceptionAsync(() =>
            subscriber.ProcessMessageAsync(UserHash, "not-json"));

        ex.ShouldBeNull();
        pusherMock.Verify(
            p => p.SendReadingUpdatedAsync(
                It.IsAny<string>(),
                It.IsAny<ReadingUpdatedEventDto>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RedisSubscriberWhenSubscribeAsyncThrowsRefCountRemainsZeroSoRetryAttemptsRedis()
    {
        // Arrange: Redis always throws on subscribe.
        var subscriberMock = new Mock<ISubscriber>();
        subscriberMock
            .Setup(s => s.SubscribeAsync(It.IsAny<RedisChannel>(), It.IsAny<CommandFlags>()))
            .ThrowsAsync(new RedisException("Connection failed"));

        var multiplexerMock = new Mock<IConnectionMultiplexer>();
        multiplexerMock.Setup(m => m.GetSubscriber(It.IsAny<object?>()))
            .Returns(subscriberMock.Object);

        var sut = new RedisRealtimeReadingSubscriber(
            multiplexerMock.Object,
            Mock.Of<IWeatherHubPusher>(),
            NullLogger<RedisRealtimeReadingSubscriber>.Instance);

        // First subscribe fails — must not poison the slot.
        _ = await Record.ExceptionAsync(() => sut.SubscribeAsync(UserHash));

        // Second subscribe must attempt Redis again (not short-circuit as "already subscribed").
        _ = await Record.ExceptionAsync(() => sut.SubscribeAsync(UserHash));

        subscriberMock.Verify(
            s => s.SubscribeAsync(It.IsAny<RedisChannel>(), It.IsAny<CommandFlags>()),
            Times.Exactly(2),
            "a failed subscribe must not increment the ref-count; the next attempt must reach Redis");
    }
}
