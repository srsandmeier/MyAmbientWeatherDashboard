using System.Text.Json;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Ambient;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// <see cref="IRealtimeReadingPublisher"/> that stores the latest reading in the distributed
/// cache and fans it out to all backend instances via a Redis pub/sub channel.
/// <para>
/// Channel name: <c>ambient:readings:{userHash}</c> (no instance-name prefix — pub/sub
/// channels are global to the Redis cluster and must not include the cache key prefix).
/// </para>
/// </summary>
public sealed partial class RedisRealtimeReadingPublisher(
    ILatestReadingCache latestReadingCache,
    IConnectionMultiplexer multiplexer,
    ILogger<RedisRealtimeReadingPublisher> logger) : IRealtimeReadingPublisher
{
    private static readonly JsonSerializerOptions JsonOptions = AmbientJsonOptions.Default;

    /// <inheritdoc />
    public async Task PublishAsync(
        string userHash,
        CurrentReadingDto reading,
        CancellationToken cancellationToken = default)
    {
        // Persist the latest reading for the REST fallback path (/api/dashboard/current).
        await latestReadingCache
            .SetAsync(userHash, reading.DeviceId, reading, cancellationToken)
            .ConfigureAwait(false);

        // Fan out to all backend instances that have a connected SignalR subscriber.
        var channel = RedisChannel.Literal($"ambient:readings:{userHash}");
        var payload = JsonSerializer.Serialize(
            new ReadingUpdatedEventDto { Reading = reading }, JsonOptions);

        try
        {
            var subscriber = multiplexer.GetSubscriber();
            await subscriber.PublishAsync(channel, payload).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogPubSubFailed(logger, ex, userHash);
        }
    }

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Realtime publisher: Redis pub/sub publish failed for user hash {UserHash}.")]
    private static partial void LogPubSubFailed(ILogger logger, Exception ex, string userHash);
}
