using System.Text.Json;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Ambient;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// <see cref="IRealtimeReadingSubscriber"/> backed by Redis pub/sub.
/// Subscribes to <c>ambient:readings:{userHash}</c> on the first connection for each
/// user hash and forwards deserialized <see cref="ReadingUpdatedEventDto"/> events to the
/// corresponding SignalR group via <see cref="IWeatherHubPusher"/>.
/// Uses <see cref="ChannelMessageQueue"/> for back-pressure; unsubscribes when the last
/// connection for a user hash disconnects.
/// </summary>
public sealed partial class RedisRealtimeReadingSubscriber(
    IConnectionMultiplexer multiplexer,
    IWeatherHubPusher hubPusher,
    ILogger<RedisRealtimeReadingSubscriber> logger) : IRealtimeReadingSubscriber
{
    private static readonly JsonSerializerOptions JsonOptions = AmbientJsonOptions.Default;

    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly Dictionary<string, int> _refCounts = new(StringComparer.Ordinal);
    private readonly Dictionary<string, ChannelMessageQueue> _queues = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Task> _tasks = new(StringComparer.Ordinal);

    /// <inheritdoc />
    public ValueTask DisposeAsync()
    {
        _lock.Dispose();
        return ValueTask.CompletedTask;
    }

    /// <inheritdoc />
    public async Task SubscribeAsync(string userHash, CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            _refCounts.TryGetValue(userHash, out var count);

            if (count > 0)
            {
                // Already subscribed — just bump the ref-count and return.
                _refCounts[userHash] = count + 1;
                return;
            }

            // Subscribe first; only increment the ref-count and register the queue on success
            // so a transient Redis failure cannot permanently poison the slot.
            var channel = RedisChannel.Literal($"ambient:readings:{userHash}");
            var queue = await multiplexer.GetSubscriber()
                .SubscribeAsync(channel)
                .ConfigureAwait(false);

            _refCounts[userHash] = 1;
            _queues[userHash] = queue;
            _tasks[userHash] = ProcessQueueAsync(userHash, queue);
            LogSubscribed(logger, userHash[..Math.Min(8, userHash.Length)]);
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <inheritdoc />
    public async Task UnsubscribeAsync(string userHash, CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (!_refCounts.TryGetValue(userHash, out var count) || count <= 0)
                return;

            var newCount = count - 1;
            _refCounts[userHash] = newCount;

            if (newCount > 0)
                return; // Other connections still active.

            _refCounts.Remove(userHash);

            if (_queues.TryGetValue(userHash, out var queue))
            {
                _queues.Remove(userHash);
                _tasks.Remove(userHash);
                await queue.UnsubscribeAsync().ConfigureAwait(false);
            }

            LogUnsubscribed(logger, userHash[..Math.Min(8, userHash.Length)]);
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task ProcessQueueAsync(string userHash, ChannelMessageQueue queue)
    {
        try
        {
            await foreach (var msg in queue.ConfigureAwait(false))
                await ProcessMessageAsync(userHash, msg.Message).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogQueueLoopFailed(logger, ex, userHash[..Math.Min(8, userHash.Length)]);

            // Clear tracked state so the next SubscribeAsync can resubscribe cleanly
            // instead of finding a live ref-count for a dead loop.
            await _lock.WaitAsync().ConfigureAwait(false);
            try
            {
                _refCounts.Remove(userHash);
                _queues.Remove(userHash);
                _tasks.Remove(userHash);
            }
            finally
            {
                _lock.Release();
            }
        }
    }

    internal async Task ProcessMessageAsync(string userHash, RedisValue message)
    {
        try
        {
            if (message.IsNullOrEmpty)
                return;

            var dto = JsonSerializer.Deserialize<ReadingUpdatedEventDto>(
                message.ToString(), JsonOptions);

            if (dto is not null)
                await hubPusher.SendReadingUpdatedAsync(userHash, dto).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogFanOutFailed(logger, ex, userHash[..Math.Min(8, userHash.Length)]);
        }
    }

    [LoggerMessage(Level = LogLevel.Debug,
        Message = "WeatherHub subscriber: subscribed for user hash prefix {HashPrefix}…")]
    private static partial void LogSubscribed(ILogger logger, string hashPrefix);

    [LoggerMessage(Level = LogLevel.Debug,
        Message = "WeatherHub subscriber: unsubscribed for user hash prefix {HashPrefix}…")]
    private static partial void LogUnsubscribed(ILogger logger, string hashPrefix);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "WeatherHub subscriber: fan-out failed for user hash prefix {HashPrefix}…")]
    private static partial void LogFanOutFailed(ILogger logger, Exception ex, string hashPrefix);

    [LoggerMessage(Level = LogLevel.Error,
        Message = "WeatherHub subscriber: message queue loop died for user hash prefix {HashPrefix}; subscription will recover on next SignalR reconnect.")]
    private static partial void LogQueueLoopFailed(ILogger logger, Exception ex, string hashPrefix);
}
