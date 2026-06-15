using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using AmbientWeather.Application.DTOs.Alerts;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Ambient;
using AmbientWeather.Infrastructure.Neighbors;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Alerts;

/// <summary>
/// Weather.gov-backed active alert service.
/// </summary>
public sealed partial class WeatherGovAlertService(
    IHttpClientFactory httpClientFactory,
    IDistributedCache cache,
    ILogger<WeatherGovAlertService> logger) : IWeatherAlertService
{
    private static readonly DistributedCacheEntryOptions CacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2),
    };

    /// <inheritdoc />
    public async Task<IReadOnlyList<WeatherAlertDto>> GetActiveAlertsAsync(
        string userHash,
        double latitude,
        double longitude,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userHash);

        if (!NeighborGeoHelper.IsWithinUsBoundingBox(latitude, longitude))
            return [];

        var cacheKey = BuildCacheKey(userHash, latitude, longitude);
        var cached = await TryGetCachedAsync(cacheKey, cancellationToken).ConfigureAwait(false);
        if (cached is not null)
            return cached;

        var alerts = await FetchActiveAlertsAsync(latitude, longitude, cancellationToken).ConfigureAwait(false);
        await TrySetCacheAsync(cacheKey, alerts, cancellationToken).ConfigureAwait(false);
        return alerts;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<WeatherAlertDto>> GetActiveAlertsForAreaAsync(
        string userHash,
        string areaCode,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userHash);

        var normalizedArea = NormalizeAreaCode(areaCode);
        if (normalizedArea is null)
            return [];

        var cacheKey = BuildAreaCacheKey(userHash, normalizedArea);
        var cached = await TryGetCachedAsync(cacheKey, cancellationToken).ConfigureAwait(false);
        if (cached is not null)
            return cached;

        var alerts = await FetchActiveAlertsForAreaAsync(normalizedArea, cancellationToken).ConfigureAwait(false);
        await TrySetCacheAsync(cacheKey, alerts, cancellationToken).ConfigureAwait(false);
        return alerts;
    }

    private async Task<IReadOnlyList<WeatherAlertDto>> FetchActiveAlertsAsync(
        double latitude,
        double longitude,
        CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient(WeatherGovNearbyObservationProvider.HttpClientName);
            var path = string.Format(
                CultureInfo.InvariantCulture,
                "/alerts/active?point={0:F4},{1:F4}&status=actual",
                latitude,
                longitude);

            var response = await client
                .GetFromJsonAsync<NwsAlertsResponse>(path, cancellationToken)
                .ConfigureAwait(false);

            return response?.Features?
                .Select(MapAlert)
                .Where(alert => !string.IsNullOrWhiteSpace(alert.Id))
                .ToList() ?? [];
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogAlertFetchFailed(logger, ex);
            return [];
        }
    }

    private async Task<IReadOnlyList<WeatherAlertDto>> FetchActiveAlertsForAreaAsync(
        string areaCode,
        CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient(WeatherGovNearbyObservationProvider.HttpClientName);
            var path = $"/alerts/active?area={Uri.EscapeDataString(areaCode)}&status=actual";

            var response = await client
                .GetFromJsonAsync<NwsAlertsResponse>(path, cancellationToken)
                .ConfigureAwait(false);

            return response?.Features?
                .Select(MapAlert)
                .Where(alert => !string.IsNullOrWhiteSpace(alert.Id))
                .ToList() ?? [];
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogAlertFetchFailed(logger, ex);
            return [];
        }
    }

    private async Task<IReadOnlyList<WeatherAlertDto>?> TryGetCachedAsync(
        string cacheKey,
        CancellationToken cancellationToken)
    {
        try
        {
            var json = await cache.GetStringAsync(cacheKey, cancellationToken).ConfigureAwait(false);
            return string.IsNullOrWhiteSpace(json)
                ? null
                : JsonSerializer.Deserialize<IReadOnlyList<WeatherAlertDto>>(json, AmbientJsonOptions.Default);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheReadFailed(logger, ex, cacheKey);
            await cache.RemoveAsync(cacheKey, cancellationToken).ConfigureAwait(false);
            return null;
        }
    }

    private async Task TrySetCacheAsync(
        string cacheKey,
        IReadOnlyList<WeatherAlertDto> alerts,
        CancellationToken cancellationToken)
    {
        try
        {
            var json = JsonSerializer.Serialize(alerts, AmbientJsonOptions.Default);
            await cache.SetStringAsync(cacheKey, json, CacheOptions, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheWriteFailed(logger, ex, cacheKey);
        }
    }

    private static WeatherAlertDto MapAlert(NwsAlertFeature feature)
    {
        var props = feature.Properties;
        return new WeatherAlertDto
        {
            Id = feature.Id ?? props?.Id ?? string.Empty,
            Event = props?.Event,
            Headline = props?.Headline,
            Description = props?.Description,
            Severity = props?.Severity,
            Urgency = props?.Urgency,
            Certainty = props?.Certainty,
            EffectiveUtc = ParseUtc(props?.Effective),
            ExpiresUtc = ParseUtc(props?.Expires),
            AreaDesc = props?.AreaDesc,
        };
    }

    private static DateTime? ParseUtc(string? value) =>
        DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto)
            ? dto.UtcDateTime
            : null;

    private static string BuildCacheKey(string userHash, double latitude, double longitude) =>
        string.Format(CultureInfo.InvariantCulture, "alerts:{0}:{1:F4}:{2:F4}", userHash, latitude, longitude);

    private static string BuildAreaCacheKey(string userHash, string areaCode) =>
        string.Format(CultureInfo.InvariantCulture, "alerts:{0}:area:{1}", userHash, areaCode);

    private static string? NormalizeAreaCode(string areaCode)
    {
        var normalized = areaCode.Trim().ToUpperInvariant();
        return WeatherGovAreaCodeRegex().IsMatch(normalized) ? normalized : null;
    }

    [GeneratedRegex("^[A-Z0-9]{2,12}$", RegexOptions.CultureInvariant, 100)]
    private static partial Regex WeatherGovAreaCodeRegex();

    [LoggerMessage(Level = LogLevel.Warning, Message = "Weather.gov active alerts request failed.")]
    private static partial void LogAlertFetchFailed(ILogger logger, Exception ex);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Weather alert cache read failed for key {CacheKey}.")]
    private static partial void LogCacheReadFailed(ILogger logger, Exception ex, string cacheKey);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Weather alert cache write failed for key {CacheKey}.")]
    private static partial void LogCacheWriteFailed(ILogger logger, Exception ex, string cacheKey);

    private sealed record NwsAlertsResponse(
        [property: JsonPropertyName("features")] IReadOnlyList<NwsAlertFeature>? Features);

    private sealed record NwsAlertFeature(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("properties")] NwsAlertProperties? Properties);

    private sealed record NwsAlertProperties(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("event")] string? Event,
        [property: JsonPropertyName("headline")] string? Headline,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("severity")] string? Severity,
        [property: JsonPropertyName("urgency")] string? Urgency,
        [property: JsonPropertyName("certainty")] string? Certainty,
        [property: JsonPropertyName("effective")] string? Effective,
        [property: JsonPropertyName("expires")] string? Expires,
        [property: JsonPropertyName("areaDesc")] string? AreaDesc);
}
