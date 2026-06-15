using System.Text.Json;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Metrics;
using AmbientWeather.Application.Features.Metrics;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Ambient;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// Pages Ambient Weather history backward, caches individual pages in the distributed cache,
/// then trims and aggregates the merged result to the requested granularity.
/// </summary>
public sealed partial class AmbientHistoryService(
    IAmbientRestClient restClient,
    IDistributedCache cache,
    IAmbientCredentialStore credentialStore,
    ILogger<AmbientHistoryService> logger) : IAmbientHistoryService
{
    private const int PageSize = 288;
    private const int MaxSupportedPages = 370;

    private sealed record HistoryCollectionResult(
        List<WeatherReadingDto> Readings,
        bool HitPageLimit,
        bool StuckLoop);

    /// <inheritdoc />
    public async Task<MetricHistoryResponseDto> GetHistoryAsync(
        string macAddress,
        string? deviceName,
        string metricKey,
        DateTime fromUtc,
        DateTime toUtc,
        string granularity,
        string range,
        string subject,
        CancellationToken cancellationToken = default)
    {
        if (!HistoryMetricMap.TryGet(metricKey, out var selector, out var unit, out var isRainfall))
        {
            throw new ArgumentException($"Unknown metric key: {metricKey}", nameof(metricKey));
        }

        var credentials = await credentialStore.GetAsync(subject, cancellationToken).ConfigureAwait(false)
            ?? throw new AmbientCredentialsRequiredException();

        var userSegmentHash = ComputeUserSegmentHash(subject);

        var collection = await CollectReadingsAsync(
            macAddress, fromUtc, toUtc, userSegmentHash, credentials.ApiKey, credentials.ApplicationKey, cancellationToken)
            .ConfigureAwait(false);

        // Dedup by dateutc and sort ascending.
        var sorted = collection.Readings
            .GroupBy(r => r.DateUtc)
            .Select(g => g.First())
            .OrderBy(r => r.DateUtc)
            .ToList();

        // Trim to [fromUtc, toUtc] inclusive.
        var fromMs = new DateTimeOffset(fromUtc, TimeSpan.Zero).ToUnixTimeMilliseconds();
        var toMs = new DateTimeOffset(toUtc, TimeSpan.Zero).ToUnixTimeMilliseconds();
        var trimmed = sorted.Where(r => r.DateUtc >= fromMs && r.DateUtc <= toMs).ToList();

        // Extract metric values from trimmed readings.
        var rawPoints = trimmed
            .Select(r => new MetricHistoryPointDto
            {
                TimestampUtc = DateTimeOffset.FromUnixTimeMilliseconds(r.DateUtc).UtcDateTime,
                Value = selector(r),
            })
            .ToList();

        // Apply granularity aggregation.
        List<MetricHistoryPointDto> points = granularity switch
        {
            "hour" => AggregateByHour(rawPoints, isRainfall),
            "day" => AggregateByDay(rawPoints, isRainfall),
            _ => rawPoints.Where(p => p.Value.HasValue).ToList(),
        };

        var warnings = BuildWarnings(rawPoints, points, collection.HitPageLimit, collection.StuckLoop);

        return new MetricHistoryResponseDto
        {
            MetricKey = metricKey,
            DeviceId = macAddress,
            DeviceName = deviceName,
            Range = range,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            Granularity = granularity,
            Unit = unit,
            Points = points,
            Warnings = warnings,
        };
    }

    /// <summary>
    /// Pages backward from <paramref name="toUtc"/> collecting all readings that cover
    /// <paramref name="fromUtc"/>. Each page is retrieved from cache or Ambient.
    /// </summary>
    private async Task<HistoryCollectionResult> CollectReadingsAsync(
        string macAddress,
        DateTime fromUtc,
        DateTime toUtc,
        string userSegmentHash,
        string apiKey,
        string applicationKey,
        CancellationToken cancellationToken)
    {
        var allReadings = new List<WeatherReadingDto>();
        var endDate = toUtc;
        long? previousOldestMs = null;
        var maxPages = CalculateMaxPages(fromUtc, toUtc);
        var coveredFromBoundary = false;
        var stoppedBeforeLimit = false;
        var stuckLoop = false;

        for (var page = 0; page < maxPages; page++)
        {
            var pageReadings = await GetPageWithCacheAsync(
                macAddress, endDate, userSegmentHash, apiKey, applicationKey, cancellationToken)
                .ConfigureAwait(false);

            if (pageReadings.Count == 0)
            {
                stoppedBeforeLimit = true;
                break;
            }

            allReadings.AddRange(pageReadings);

            var oldestMs = pageReadings.Min(r => r.DateUtc);
            var oldestUtc = DateTimeOffset.FromUnixTimeMilliseconds(oldestMs).UtcDateTime;

            // Stop when we've covered the from boundary.
            if (oldestUtc <= fromUtc)
            {
                coveredFromBoundary = true;
                stoppedBeforeLimit = true;
                break;
            }

            // Stop when timestamps are no longer moving backward (stuck/loop guard).
            if (previousOldestMs.HasValue && oldestMs >= previousOldestMs.Value)
            {
                stuckLoop = true;
                stoppedBeforeLimit = true;
                break;
            }

            previousOldestMs = oldestMs;
            endDate = oldestUtc.AddMilliseconds(-1);
        }

        return new HistoryCollectionResult(
            allReadings,
            HitPageLimit: !coveredFromBoundary && !stoppedBeforeLimit,
            StuckLoop: stuckLoop);
    }

    /// <summary>
    /// Returns a single page of readings from cache on hit, or from Ambient on miss (then caches it).
    /// Corrupt cache entries are evicted and refetched once.
    /// </summary>
    private async Task<IReadOnlyList<WeatherReadingDto>> GetPageWithCacheAsync(
        string macAddress,
        DateTime endDate,
        string userSegmentHash,
        string apiKey,
        string applicationKey,
        CancellationToken cancellationToken)
    {
        var cacheKey = BuildPageCacheKey(userSegmentHash, macAddress, endDate, PageSize);

        try
        {
            var cached = await cache.GetStringAsync(cacheKey, cancellationToken).ConfigureAwait(false);
            if (!string.IsNullOrEmpty(cached))
            {
                try
                {
                    var deserialized = JsonSerializer.Deserialize<List<WeatherReadingDto>>(
                        cached, AmbientJsonOptions.Default);

                    if (deserialized != null)
                        return deserialized;
                }
                catch (JsonException ex)
                {
                    LogCacheReadFailed(logger, ex, cacheKey);
                }

                // Corrupt entry — evict and fall through to Ambient.
                await cache.RemoveAsync(cacheKey, cancellationToken).ConfigureAwait(false);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheReadFailed(logger, ex, cacheKey);
        }

        // Cache miss — fetch from Ambient via the rate-limited client.
        var response = await restClient.GetDeviceHistoryAsync(
            macAddress, apiKey, applicationKey, PageSize, endDate, cancellationToken)
            .ConfigureAwait(false);

        var readings = response?.Readings ?? [];

        // Persist the page.
        try
        {
            var ttl = GetPageTtl(endDate);
            var json = JsonSerializer.Serialize((IReadOnlyList<WeatherReadingDto>)readings, AmbientJsonOptions.Default);
            await cache.SetStringAsync(
                cacheKey,
                json,
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl },
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheWriteFailed(logger, ex, cacheKey);
        }

        return readings;
    }

    // -------------------------------------------------------------------------
    // Aggregation helpers
    // -------------------------------------------------------------------------

    private static List<MetricHistoryPointDto> AggregateByHour(
        List<MetricHistoryPointDto> points, bool isRainfall) =>
        points
            .Where(p => p.Value.HasValue)
            .GroupBy(p => new DateTime(
                p.TimestampUtc.Year, p.TimestampUtc.Month, p.TimestampUtc.Day,
                p.TimestampUtc.Hour, 0, 0, DateTimeKind.Utc))
            .Select(g => new MetricHistoryPointDto
            {
                TimestampUtc = g.Key,
                Value = isRainfall ? g.Sum(p => p.Value!.Value) : g.Average(p => p.Value!.Value),
            })
            .OrderBy(p => p.TimestampUtc)
            .ToList();

    private static List<MetricHistoryPointDto> AggregateByDay(
        List<MetricHistoryPointDto> points, bool isRainfall) =>
        points
            .Where(p => p.Value.HasValue)
            .GroupBy(p => DateTime.SpecifyKind(p.TimestampUtc.Date, DateTimeKind.Utc))
            .Select(g => new MetricHistoryPointDto
            {
                TimestampUtc = g.Key,
                Value = isRainfall ? g.Sum(p => p.Value!.Value) : g.Average(p => p.Value!.Value),
            })
            .OrderBy(p => p.TimestampUtc)
            .ToList();

    // -------------------------------------------------------------------------
    // Cache key and TTL helpers
    // -------------------------------------------------------------------------

    private static string BuildPageCacheKey(
        string userSegmentHash, string macAddress, DateTime endDate, int limit)
    {
        var normalizedMac = MacAddressValidator.Normalize(macAddress);
        var endEpochMs = new DateTimeOffset(endDate, TimeSpan.Zero).ToUnixTimeMilliseconds();
        return $"history-page:{userSegmentHash}:{normalizedMac}:{endEpochMs}:{limit}";
    }

    private static TimeSpan GetPageTtl(DateTime endDate)
    {
        // Recent pages (endDate within 24 h of now) refresh frequently;
        // older historical pages can be held much longer.
        return DateTime.UtcNow - endDate < TimeSpan.FromHours(24)
            ? TimeSpan.FromMinutes(15)
            : TimeSpan.FromHours(6);
    }

    private static int CalculateMaxPages(DateTime fromUtc, DateTime toUtc)
    {
        var requestedDays = Math.Max(1, (int)Math.Ceiling((toUtc - fromUtc).TotalDays));
        return Math.Min(MaxSupportedPages, requestedDays + 2);
    }

    // -------------------------------------------------------------------------
    // Warning helpers
    // -------------------------------------------------------------------------

    private static List<string> BuildWarnings(
        List<MetricHistoryPointDto> rawPoints,
        List<MetricHistoryPointDto> returnedPoints,
        bool hitPageLimit,
        bool stuckLoop)
    {
        var warnings = new List<string>();

        if (rawPoints.Count == 0)
            warnings.Add("No data was found for the requested time range.");
        else if (returnedPoints.Count == 0)
            warnings.Add("No values were reported for this sensor in the requested time range.");
        else if (rawPoints.Any(p => !p.Value.HasValue))
            warnings.Add("Some readings are missing values for this sensor.");

        if (hitPageLimit)
            warnings.Add("The requested time range may be incomplete because the history page limit was reached.");

        if (stuckLoop)
            warnings.Add("History paging stopped early because the data source returned non-advancing timestamps; the data may be incomplete.");

        return warnings;
    }

    private static string ComputeUserSegmentHash(string subject) =>
        UserSegmentHash.Compute(subject);

    // -------------------------------------------------------------------------
    // Logger messages
    // -------------------------------------------------------------------------

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "History page cache read failed for key {CacheKey}; fetching from Ambient.")]
    private static partial void LogCacheReadFailed(ILogger logger, Exception ex, string cacheKey);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "History page cache write failed for key {CacheKey}.")]
    private static partial void LogCacheWriteFailed(ILogger logger, Exception ex, string cacheKey);
}
