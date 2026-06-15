using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Features.PublicSources;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.Ambient;
using AmbientWeather.Infrastructure.Neighbors;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.PublicSources;

/// <summary>
/// Resolves current readings from user-selected Weather.gov and Open-Meteo sources.
/// </summary>
public sealed partial class PublicSourceCurrentReadingService(
    IHttpClientFactory httpClientFactory,
    IDistributedCache cache,
    ILogger<PublicSourceCurrentReadingService> logger) : IPublicSourceCurrentReadingService
{
    private static readonly DistributedCacheEntryOptions CacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2),
    };

    /// <inheritdoc />
    public async Task<CurrentReadingDto> GetCurrentAsync(
        string userHash,
        PublicWeatherSource source,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userHash);
        ArgumentNullException.ThrowIfNull(source);

        var cacheKey = $"public-source-current:{userHash}:{source.Id}";
        var cached = await TryGetCachedAsync(cacheKey, cancellationToken).ConfigureAwait(false);
        if (cached is not null)
            return cached;

        var reading = source.Provider switch
        {
            PublicWeatherSourceProviders.WeatherGov => await FetchWeatherGovAsync(source, cancellationToken).ConfigureAwait(false),
            PublicWeatherSourceProviders.OpenMeteo => await FetchOpenMeteoAsync(source, cancellationToken).ConfigureAwait(false),
            _ => CreateShell(source),
        };

        await TrySetCacheAsync(cacheKey, reading, cancellationToken).ConfigureAwait(false);
        return reading;
    }

    private async Task<CurrentReadingDto> FetchWeatherGovAsync(
        PublicWeatherSource source,
        CancellationToken cancellationToken)
    {
        if (!NeighborGeoHelper.IsWithinUsBoundingBox(source.Latitude, source.Longitude))
            return CreateShell(source);

        try
        {
            var client = httpClientFactory.CreateClient(WeatherGovNearbyObservationProvider.HttpClientName);
            var response = await client
                .GetFromJsonAsync<NwsResponseTypes.NwsObservationResponse>(
                    $"/stations/{Uri.EscapeDataString(source.SourceId)}/observations/latest",
                    cancellationToken)
                .ConfigureAwait(false);

            var props = response?.Properties;
            var tempF = NeighborGeoHelper.CelsiusToF(props?.Temperature?.Value);
            var humidity = NeighborGeoHelper.RoundToInt(props?.RelativeHumidity?.Value);
            return CreateShell(source) with
            {
                TimestampUtc = ParseUtc(props?.Timestamp) ?? DateTime.UtcNow,
                TempF = tempF,
                Humidity = humidity,
                DewPoint = NeighborGeoHelper.CelsiusToF(props?.DewPoint?.Value),
                FeelsLike = NeighborGeoHelper.ApproximateFeelsLikeF(tempF, humidity, NeighborGeoHelper.KmhToMph(props?.WindSpeed?.Value)),
                BaromRelIn = NeighborGeoHelper.PaToInHg(props?.BarometricPressure?.Value),
                WindDir = NeighborGeoHelper.RoundToInt(props?.WindDirection?.Value),
                WindSpeedMph = NeighborGeoHelper.KmhToMph(props?.WindSpeed?.Value),
                WindGustMph = NeighborGeoHelper.KmhToMph(props?.WindGust?.Value),
                NwsSkyConditions = NwsTextFormatter.FormatCloudLayers(props?.CloudLayers),
                NwsPresentWeather = NwsTextFormatter.FormatPresentWeather(props?.PresentWeather),
                NwsTextDescription = props?.TextDescription,
                NwsRawMetar = props?.RawMessage,
            };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogPublicSourceCurrentFailed(logger, ex, source.Provider, source.SourceId);
            return CreateShell(source);
        }
    }

    private async Task<CurrentReadingDto> FetchOpenMeteoAsync(
        PublicWeatherSource source,
        CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient(OpenMeteoNearbyBaselineProvider.HttpClientName);
            var timezone = string.IsNullOrWhiteSpace(source.Timezone) ? "auto" : source.Timezone.Trim();
            var path = OpenMeteoUriBuilder.BuildPublicSourceCurrentReading(source.Latitude, source.Longitude, timezone);

            var response = await client
                .GetFromJsonAsync<OpenMeteoCurrentResponse>(path, cancellationToken)
                .ConfigureAwait(false);

            var current = response?.Current;
            var responseTimezone = string.IsNullOrWhiteSpace(response?.Timezone) ? source.Timezone : response.Timezone;

            var daily = response?.Daily;
            var hourly = response?.Hourly;
            return CreateShell(source) with
            {
                TimestampUtc = ParseOpenMeteoUtc(current?.Time, response?.UtcOffsetSeconds) ?? DateTime.UtcNow,
                TempF = current?.Temperature2m,
                Humidity = current?.RelativeHumidity2m,
                DewPoint = current?.DewPoint2m,
                FeelsLike = current?.ApparentTemperature,
                BaromRelIn = NeighborGeoHelper.HpaToInHg(current?.PressureMsl),
                WindSpeedMph = current?.WindSpeed10m,
                WindDir = current?.WindDirection10m,
                WindGustMph = current?.WindGusts10m,
                Uv = current?.UvIndex.HasValue == true ? (int?)Math.Round(current.UvIndex.Value) : null,
                Tz = responseTimezone,
                OmCloudCover = current?.CloudCover,
                OmPrecipProbability = hourly?.PrecipitationProbability?.ElementAtOrDefault(0),
                OmWeatherDescription = WmoWeatherDescriptions.Describe(current?.WeatherCode),
                OmSunrise = OpenMeteoLocalTime.Format(daily?.Sunrise?.ElementAtOrDefault(0)),
                OmSunset = OpenMeteoLocalTime.Format(daily?.Sunset?.ElementAtOrDefault(0)),
                OmUvIndexMax = daily?.UvIndexMax?.ElementAtOrDefault(0) is { } uvMax ? (int?)Math.Round(uvMax) : null,
                OmPrecipSumIn = daily?.PrecipitationSum?.ElementAtOrDefault(0),
                OmWindSpeedMax = daily?.WindSpeedMax?.ElementAtOrDefault(0),
                OmWindGustMax = daily?.WindGustsMax?.ElementAtOrDefault(0),
                OmWindDirDominant = daily?.WindDirectionDominant?.ElementAtOrDefault(0) is { } wdd ? (int?)Math.Round(wdd) : null,
            };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogPublicSourceCurrentFailed(logger, ex, source.Provider, source.SourceId);
            return CreateShell(source);
        }
    }

    private async Task<CurrentReadingDto?> TryGetCachedAsync(string cacheKey, CancellationToken cancellationToken)
    {
        try
        {
            var json = await cache.GetStringAsync(cacheKey, cancellationToken).ConfigureAwait(false);
            return string.IsNullOrWhiteSpace(json)
                ? null
                : JsonSerializer.Deserialize<CurrentReadingDto>(json, AmbientJsonOptions.Default);
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
        CurrentReadingDto reading,
        CancellationToken cancellationToken)
    {
        try
        {
            await cache.SetStringAsync(
                cacheKey,
                JsonSerializer.Serialize(reading, AmbientJsonOptions.Default),
                CacheOptions,
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogCacheWriteFailed(logger, ex, cacheKey);
        }
    }

    private static CurrentReadingDto CreateShell(PublicWeatherSource source) => new()
    {
        DeviceId = $"public:{source.Id}",
        DeviceName = $"{ProviderDisplayName(source.Provider)}.{source.DisplayLabel}",
        TimestampUtc = DateTime.UtcNow,
        ReceivedAtUtc = DateTime.UtcNow,
        Source = "public",
        Tz = source.Timezone,
    };

    private static string ProviderDisplayName(string provider) =>
        string.Equals(provider, PublicWeatherSourceProviders.WeatherGov, StringComparison.Ordinal)
            ? "Weather.gov"
            : "Open-Meteo";

    private static DateTime? ParseUtc(string? value) =>
        DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto)
            ? dto.UtcDateTime
            : null;

    private static DateTime? ParseOpenMeteoUtc(string? value, int? utcOffsetSeconds)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            return null;

        if (utcOffsetSeconds.HasValue)
        {
            var unspecifiedLocal = DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);
            return new DateTimeOffset(unspecifiedLocal, TimeSpan.FromSeconds(utcOffsetSeconds.Value)).UtcDateTime;
        }

        return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Public source current request failed for {Provider}:{SourceId}.")]
    private static partial void LogPublicSourceCurrentFailed(ILogger logger, Exception ex, string provider, string sourceId);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Public source current cache read failed for key {CacheKey}.")]
    private static partial void LogCacheReadFailed(ILogger logger, Exception ex, string cacheKey);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Public source current cache write failed for key {CacheKey}.")]
    private static partial void LogCacheWriteFailed(ILogger logger, Exception ex, string cacheKey);

    private sealed record OpenMeteoCurrentResponse(
        [property: JsonPropertyName("timezone")] string? Timezone,
        [property: JsonPropertyName("utc_offset_seconds")] int? UtcOffsetSeconds,
        [property: JsonPropertyName("latitude")] double? Latitude,
        [property: JsonPropertyName("longitude")] double? Longitude,
        [property: JsonPropertyName("current")] OpenMeteoCurrent? Current,
        [property: JsonPropertyName("hourly")] OpenMeteoHourlyData? Hourly,
        [property: JsonPropertyName("daily")] OpenMeteoDailyData? Daily);

    private sealed record OpenMeteoHourlyData(
        [property: JsonPropertyName("precipitation_probability")] IReadOnlyList<int?>? PrecipitationProbability);

    private sealed record OpenMeteoCurrent(
        [property: JsonPropertyName("time")] string? Time,
        [property: JsonPropertyName("temperature_2m")] double? Temperature2m,
        [property: JsonPropertyName("relative_humidity_2m")] int? RelativeHumidity2m,
        [property: JsonPropertyName("apparent_temperature")] double? ApparentTemperature,
        [property: JsonPropertyName("dew_point_2m")] double? DewPoint2m,
        [property: JsonPropertyName("pressure_msl")] double? PressureMsl,
        [property: JsonPropertyName("wind_speed_10m")] double? WindSpeed10m,
        [property: JsonPropertyName("wind_direction_10m")] int? WindDirection10m,
        [property: JsonPropertyName("wind_gusts_10m")] double? WindGusts10m,
        [property: JsonPropertyName("uv_index")] double? UvIndex,
        [property: JsonPropertyName("weather_code")] int? WeatherCode,
        [property: JsonPropertyName("cloud_cover")] int? CloudCover);

    private sealed record OpenMeteoDailyData(
        [property: JsonPropertyName("uv_index_max")] IReadOnlyList<double?>? UvIndexMax,
        [property: JsonPropertyName("precipitation_sum")] IReadOnlyList<double?>? PrecipitationSum,
        [property: JsonPropertyName("sunrise")] IReadOnlyList<string?>? Sunrise,
        [property: JsonPropertyName("sunset")] IReadOnlyList<string?>? Sunset,
        [property: JsonPropertyName("wind_speed_10m_max")] IReadOnlyList<double?>? WindSpeedMax,
        [property: JsonPropertyName("wind_gusts_10m_max")] IReadOnlyList<double?>? WindGustsMax,
        [property: JsonPropertyName("wind_direction_10m_dominant")] IReadOnlyList<double?>? WindDirectionDominant);
}
