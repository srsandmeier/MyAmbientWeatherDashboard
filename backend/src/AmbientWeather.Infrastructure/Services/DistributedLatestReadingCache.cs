using System.Text.Json;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Ambient;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// <see cref="ILatestReadingCache"/> backed by <see cref="IDistributedCache"/>.
/// Works with both the Redis and in-memory distributed cache registrations, so no
/// separate implementation is needed for Development or Testing environments.
/// Keys follow the pattern <c>latest-reading:{userHash}:{normalizedMac}</c>.
/// Entries expire after 5 minutes — callers can detect stale/offline states by
/// comparing the cached <see cref="CurrentReadingDto.ReceivedAtUtc"/> value.
/// </summary>
public sealed partial class DistributedLatestReadingCache(
    IDistributedCache cache,
    ILogger<DistributedLatestReadingCache> logger) : ILatestReadingCache
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);

    private static readonly JsonSerializerOptions JsonOptions = AmbientJsonOptions.Default;

    private static readonly DistributedCacheEntryOptions CacheOptions =
        new() { AbsoluteExpirationRelativeToNow = Ttl };

    /// <inheritdoc />
    public async Task<CurrentReadingDto?> GetAsync(
        string userHash,
        string normalizedMac,
        CancellationToken cancellationToken = default)
    {
        var key = BuildKey(userHash, normalizedMac);

        try
        {
            var json = await cache.GetStringAsync(key, cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrEmpty(json))
                return null;

            return JsonSerializer.Deserialize<CurrentReadingDto>(json, JsonOptions);
        }
        catch (JsonException ex)
        {
            LogCorruptEntry(logger, ex, key);
            await RemoveAsync(userHash, normalizedMac, cancellationToken).ConfigureAwait(false);
            return null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheReadFailed(logger, ex, key);
            return null;
        }
    }

    /// <inheritdoc />
    public async Task SetAsync(
        string userHash,
        string normalizedMac,
        CurrentReadingDto reading,
        CancellationToken cancellationToken = default)
    {
        var key = BuildKey(userHash, normalizedMac);

        try
        {
            var json = JsonSerializer.Serialize(reading, JsonOptions);
            await cache.SetStringAsync(key, json, CacheOptions, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheWriteFailed(logger, ex, key);
        }
    }

    /// <inheritdoc />
    public async Task RemoveAsync(
        string userHash,
        string normalizedMac,
        CancellationToken cancellationToken = default)
    {
        var key = BuildKey(userHash, normalizedMac);

        try
        {
            await cache.RemoveAsync(key, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheRemoveFailed(logger, ex, key);
        }
    }

    private static string BuildKey(string userHash, string normalizedMac) =>
        $"latest-reading:{userHash}:{normalizedMac}";

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Latest-reading cache: corrupt entry at key {Key}; returning null.")]
    private static partial void LogCorruptEntry(ILogger logger, Exception ex, string key);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Latest-reading cache: read failed for key {Key}.")]
    private static partial void LogCacheReadFailed(ILogger logger, Exception ex, string key);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Latest-reading cache: write failed for key {Key}.")]
    private static partial void LogCacheWriteFailed(ILogger logger, Exception ex, string key);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Latest-reading cache: remove failed for key {Key}.")]
    private static partial void LogCacheRemoveFailed(ILogger logger, Exception ex, string key);
}
