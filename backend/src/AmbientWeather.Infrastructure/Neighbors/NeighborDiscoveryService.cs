using System.Text.Json;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Domain.Neighbors;
using AmbientWeather.Infrastructure.Ambient;
using AmbientWeather.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Discovers nearby public weather stations by calling all registered
/// <see cref="INearbyWeatherProvider"/> implementations, deduplicates and sorts the results,
/// upserts to <c>neighbor_station_cache</c>, and wraps everything in a Redis cache-aside layer.
/// Cache key: <c>neighbor-list:{userHash}</c>; TTL = <see cref="NeighborConfig.RefreshIntervalMinutes"/>.
/// </summary>
public sealed partial class NeighborDiscoveryService(
    IReadOnlyList<INearbyWeatherProvider> providers,
    IDistributedCache cache,
    AmbientWeatherDbContext dbContext,
    ILogger<NeighborDiscoveryService> logger) : INeighborDiscoveryService
{
    private const int MaxResults = 50;

    /// <inheritdoc />
    public async Task<IReadOnlyList<NeighborStation>> GetOrDiscoverAsync(
        string userHash,
        NeighborConfig config,
        CancellationToken cancellationToken = default)
    {
        var cacheKey = BuildKey(userHash, config);

        if (!config.ForceRefresh)
        {
            var cached = await TryGetCachedAsync(cacheKey, cancellationToken).ConfigureAwait(false);
            if (cached is not null)
                return cached;
        }

        var discovered = await RunDiscoveryAsync(config, cancellationToken).ConfigureAwait(false);

        await PersistAsync(userHash, discovered, cancellationToken).ConfigureAwait(false);

        var ttl = TimeSpan.FromMinutes(config.RefreshIntervalMinutes);
        await TrySetCacheAsync(cacheKey, discovered, ttl, cancellationToken).ConfigureAwait(false);

        return discovered;
    }

    /// <inheritdoc />
    public async Task InvalidateCacheAsync(
        string userHash,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await cache.RemoveAsync(BuildLegacyKey(userHash), cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheRemoveFailed(logger, ex, userHash);
        }
    }

    private async Task<List<NeighborStation>> RunDiscoveryAsync(
        NeighborConfig config, CancellationToken ct)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var cutoff = DateTime.UtcNow.AddMinutes(-config.MaxAgeMinutes);
        var merged = new List<NeighborStation>();

        foreach (var provider in providers)
        {
            IReadOnlyList<NeighborStation> results;
            try
            {
                results = await provider.DiscoverAsync(config, ct).ConfigureAwait(false);
            }
            catch (OperationCanceledException ex) when (!ct.IsCancellationRequested)
            {
                LogProviderFailed(logger, ex, provider.ProviderName);
                continue;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogProviderFailed(logger, ex, provider.ProviderName);
                continue;
            }

            foreach (var station in results)
            {
                if (station.LastObservedAtUtc < cutoff) continue;
                if (station.DistanceMiles > config.RadiusMiles) continue;
                if (!seen.Add($"{station.Provider}:{station.SourceId}")) continue;
                merged.Add(station);
            }
        }

        return merged
            .OrderBy(s => s.DistanceMiles)
            .Take(MaxResults)
            .ToList();
    }

    private async Task PersistAsync(
        string userHash, IReadOnlyList<NeighborStation> stations, CancellationToken ct)
    {
        try
        {
            await dbContext.NeighborStationCaches
                .Where(e => e.UserHash == userHash)
                .ExecuteDeleteAsync(ct)
                .ConfigureAwait(false);

            var entities = stations.Select(s => new NeighborStationCache
            {
                Id = Guid.NewGuid(),
                UserHash = userHash,
                Provider = s.Provider,
                SourceId = s.SourceId,
                Name = s.Name,
                Lat = s.Lat,
                Lon = s.Lon,
                DistanceMiles = s.DistanceMiles,
                LastObservedAtUtc = s.LastObservedAtUtc,
                FreshnessMinutes = s.FreshnessMinutes,
                RawReadingJson = JsonSerializer.Serialize(s, AmbientJsonOptions.Default),
                CachedAtUtc = DateTime.UtcNow,
            });

            await dbContext.NeighborStationCaches.AddRangeAsync(entities, ct).ConfigureAwait(false);
            await dbContext.SaveChangesAsync(ct).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogPersistFailed(logger, ex, userHash);
        }
    }

    private async Task<IReadOnlyList<NeighborStation>?> TryGetCachedAsync(
        string key, CancellationToken ct)
    {
        try
        {
            var json = await cache.GetStringAsync(key, ct).ConfigureAwait(false);
            if (string.IsNullOrEmpty(json)) return null;
            return JsonSerializer.Deserialize<List<NeighborStation>>(json, AmbientJsonOptions.Default);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheReadFailed(logger, ex, key);
            return null;
        }
    }

    private async Task TrySetCacheAsync(
        string key, IReadOnlyList<NeighborStation> stations, TimeSpan ttl, CancellationToken ct)
    {
        try
        {
            var json = JsonSerializer.Serialize(stations, AmbientJsonOptions.Default);
            await cache.SetStringAsync(
                key, json,
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl },
                ct).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheWriteFailed(logger, ex, key);
        }
    }

    /// <inheritdoc />
    public async Task<NeighborStation?> GetCachedStationAsync(
        string userHash,
        string provider,
        string sourceId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var entry = await dbContext.NeighborStationCaches
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    e => e.UserHash == userHash
                         && e.Provider == provider
                         && e.SourceId == sourceId,
                    cancellationToken)
                .ConfigureAwait(false);

            if (entry is null || string.IsNullOrEmpty(entry.RawReadingJson))
                return null;

            return JsonSerializer.Deserialize<NeighborStation>(entry.RawReadingJson, AmbientJsonOptions.Default);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCachedStationReadFailed(logger, ex, provider, sourceId);
            return null;
        }
    }

    private static string BuildKey(string userHash, NeighborConfig config)
    {
        var scope = string.IsNullOrWhiteSpace(config.DiscoveryCacheScope)
            ? "finder"
            : config.DiscoveryCacheScope.Trim();
        var providers = config.EnabledProviders.Count == 0
            ? "all"
            : string.Join("-", config.EnabledProviders.Order(StringComparer.Ordinal));
        var lat = config.UserLatitude?.ToString("F4", System.Globalization.CultureInfo.InvariantCulture) ?? "none";
        var lon = config.UserLongitude?.ToString("F4", System.Globalization.CultureInfo.InvariantCulture) ?? "none";
        var radius = config.RadiusMiles.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture);
        return $"neighbor-list:{userHash}:{scope}:{lat}:{lon}:r{radius}:p{providers}";
    }

    private static string BuildLegacyKey(string userHash) => $"neighbor-list:{userHash}";

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "NeighborDiscoveryService: provider {Provider} threw during discovery.")]
    private static partial void LogProviderFailed(ILogger logger, Exception ex, string provider);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "NeighborDiscoveryService: failed to persist cache to DB for user hash {UserHash}.")]
    private static partial void LogPersistFailed(ILogger logger, Exception ex, string userHash);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "NeighborDiscoveryService: cache read failed for key {Key}.")]
    private static partial void LogCacheReadFailed(ILogger logger, Exception ex, string key);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "NeighborDiscoveryService: cache write failed for key {Key}.")]
    private static partial void LogCacheWriteFailed(ILogger logger, Exception ex, string key);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "NeighborDiscoveryService: cache remove failed for user hash {UserHash}.")]
    private static partial void LogCacheRemoveFailed(ILogger logger, Exception ex, string userHash);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "NeighborDiscoveryService: failed to read cached station {Provider}:{SourceId}.")]
    private static partial void LogCachedStationReadFailed(
        ILogger logger, Exception ex, string provider, string sourceId);
}
