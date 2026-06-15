using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using AmbientWeather.Domain.Neighbors;
using AmbientWeather.Infrastructure.Ambient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Discovers nearby public Ambient Weather stations via the undocumented Open REST API
/// at <c>https://lightning.ambientweather.net</c>.
/// Disabled by default; enable with <c>Features:AmbientOpenApiEnabled=true</c>.
/// Returns an empty list rather than throwing on any API failure.
/// </summary>
public sealed partial class AmbientOpenWeatherProvider(
    IHttpClientFactory httpClientFactory,
    AmbientRateLimitState rateLimitState,
    IConfiguration configuration,
    ILogger<AmbientOpenWeatherProvider> logger) : INearbyWeatherProvider
{
    internal const string HttpClientName = "AmbientOpenWeatherRest";
    private static readonly TimeSpan RateInterval = TimeSpan.FromSeconds(1);
    private const string RateBucket = "ambient-open:global";

    /// <summary>
    /// Empirical maximum effective radius supported by the Ambient Open bounding-box API.
    /// Queries beyond this distance return no additional stations; the bounding box is clamped
    /// to this value automatically and the caller is informed via a log message.
    /// </summary>
    public const double MaxEffectiveRadiusMiles = 34.0;

    /// <inheritdoc />
    public string ProviderName => "AmbientOpen";

    /// <inheritdoc />
    public async Task<IReadOnlyList<NeighborStation>> DiscoverAsync(
        NeighborConfig config,
        CancellationToken cancellationToken = default)
    {
        if (!IsEnabled(config)) return [];

        var lat = config.UserLatitude!.Value;
        var lon = config.UserLongitude!.Value;
        var uri = BuildRequestUri(config, lat, lon);

        await rateLimitState.WaitAsync(RateBucket, RateInterval, cancellationToken)
            .ConfigureAwait(false);

        var response = await FetchAsync(uri, cancellationToken).ConfigureAwait(false);
        if (response?.Data is not { Count: > 0 })
        {
            LogNoStationsReturned(logger);
            return [];
        }

        return MapStations(response.Data, lat, lon, config);
    }

    private string BuildRequestUri(NeighborConfig config, double lat, double lon)
    {
        var queryRadius = Math.Min(config.RadiusMiles, MaxEffectiveRadiusMiles);
        if (config.RadiusMiles > MaxEffectiveRadiusMiles)
            LogRadiusClamped(logger, config.RadiusMiles, MaxEffectiveRadiusMiles);

        var (swLat, swLon, neLat, neLon) = NeighborGeoHelper.BoundingBox(lat, lon, queryRadius);
        return string.Format(
            CultureInfo.InvariantCulture,
            "/devices?$publicBox[0][0]={0:F6}&$publicBox[0][1]={1:F6}&$publicBox[1][0]={2:F6}&$publicBox[1][1]={3:F6}&$limit=1000",
            swLon, swLat, neLon, neLat);
    }

    private async Task<AmbientOpenResponse?> FetchAsync(string uri, CancellationToken ct)
    {
        try
        {
            var client = httpClientFactory.CreateClient(HttpClientName);
            using var httpResponse = await client.GetAsync(uri, ct).ConfigureAwait(false);

            if (httpResponse.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                LogRateLimited(logger);
                return null;
            }

            if (!httpResponse.IsSuccessStatusCode)
            {
                LogDiscoveryHttpError(logger, (int)httpResponse.StatusCode);
                return null;
            }

            var body = await httpResponse.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
            return System.Text.Json.JsonSerializer.Deserialize<AmbientOpenResponse>(body, AmbientJsonOptions.Default);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogDiscoveryFailed(logger, ex);
            return null;
        }
    }

    private List<NeighborStation> MapStations(
        IReadOnlyList<AmbientOpenStationDto> data, double lat, double lon, NeighborConfig config)
    {
        var rawCount = data.Count;
        if (rawCount >= 1000)
            LogLimitHit(logger, rawCount);

        var cutoff = DateTime.UtcNow.AddMinutes(-config.MaxAgeMinutes);
        var results = new List<NeighborStation>(rawCount);

        foreach (var station in data)
        {
            var mapped = TryMapStation(station, lat, lon, cutoff);
            if (mapped is not null)
                results.Add(mapped);
        }

        LogDiscoveryResult(logger, rawCount, results.Count, config.RadiusMiles, config.MaxAgeMinutes);
        return results;
    }

    private bool IsEnabled(NeighborConfig config)
    {
        if (config.UserLatitude is null || config.UserLongitude is null) return false;
        if (!config.IsEnabled) return false;
        if (config.EnabledProviders.Count > 0 && !config.EnabledProviders.Contains(ProviderName, StringComparer.Ordinal)) return false;
        return configuration.GetValue<bool>("Features:AmbientOpenApiEnabled");
    }

    private NeighborStation? TryMapStation(
        AmbientOpenStationDto station, double userLat, double userLon, DateTime cutoff)
    {
        var mac = station.MacAddress;
        var (lat, lon) = ResolveCoordinates(station.Info?.Coords);
        var lastData = station.LastData;

        if (mac is null || lat is null || lon is null || lastData is null) return null;
        if (station.Info?.Indoor == true) return null;

        DateTime? observedAt = null;
        if (lastData.DateUtc is { } ms)
        {
            observedAt = DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime;
            if (observedAt < cutoff) return null;
        }

        var tempF = lastData.TempF;
        var humidity = lastData.Humidity;
        var windSpeed = lastData.WindSpeedMph;

        var dewPoint = lastData.DewPoint
            ?? NeighborGeoHelper.ApproximateDewPointF(tempF, humidity);
        var feelsLike = lastData.FeelsLike
            ?? NeighborGeoHelper.ApproximateFeelsLikeF(tempF, humidity, windSpeed);

        var distance = NeighborGeoHelper.HaversineDistanceMiles(userLat, userLon, lat.Value, lon.Value);
        int? freshness = observedAt.HasValue
            ? (int)(DateTime.UtcNow - observedAt.Value).TotalMinutes
            : null;

        return new NeighborStation
        {
            Provider = ProviderName,
            SourceId = mac,
            Name = station.Info?.Name,
            Lat = lat.Value,
            Lon = lon.Value,
            DistanceMiles = distance,
            LastObservedAtUtc = observedAt,
            FreshnessMinutes = freshness,
            TempF = tempF,
            Humidity = humidity,
            DewPoint = dewPoint,
            FeelsLike = feelsLike,
            BaromRelIn = lastData.BaromRelIn,
            BaromAbsIn = lastData.BaromAbsIn,
            WindSpeedMph = windSpeed,
            WindGustMph = lastData.WindGustMph,
            WindDir = lastData.WindDir,
            HourlyRainIn = lastData.HourlyRainIn,
            DailyRainIn = lastData.DailyRainIn,
            WeeklyRainIn = lastData.WeeklyRainIn,
            MonthlyRainIn = lastData.MonthlyRainIn,
            YearlyRainIn = lastData.YearlyRainIn,
            SolarRadiation = lastData.SolarRadiation,
            Uv = lastData.Uv,
        };
    }

    private static (double? Lat, double? Lon) ResolveCoordinates(AmbientOpenCoordsContainerDto? coords)
    {
        if (coords?.Coords is { } nested)
            return (nested.Lat, nested.Lon);

        var geoCoordinates = coords?.Geo?.Coordinates;
        if (geoCoordinates is { Count: >= 2 })
            return (geoCoordinates[1], geoCoordinates[0]);

        return (null, null);
    }

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "AmbientOpenWeatherProvider: discovery request failed.")]
    private static partial void LogDiscoveryFailed(ILogger logger, Exception ex);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "AmbientOpenWeatherProvider: rate-limited by the Ambient Open API (HTTP 429). Results will be empty until the next refresh.")]
    private static partial void LogRateLimited(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "AmbientOpenWeatherProvider: HTTP {StatusCode} from Ambient Open API — returning empty list.")]
    private static partial void LogDiscoveryHttpError(ILogger logger, int statusCode);

    [LoggerMessage(Level = LogLevel.Information,
        Message = "AmbientOpenWeatherProvider: API returned 0 stations for bounding box.")]
    private static partial void LogNoStationsReturned(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "AmbientOpenWeatherProvider: API returned {Count} stations — $limit may have been hit. Some stations could be missing.")]
    private static partial void LogLimitHit(ILogger logger, int count);

    [LoggerMessage(Level = LogLevel.Information,
        Message = "AmbientOpenWeatherProvider: {RawCount} raw stations → {MappedCount} mapped (radius {RadiusMiles} mi, max age {MaxAgeMinutes} min).")]
    private static partial void LogDiscoveryResult(ILogger logger, int rawCount, int mappedCount, double radiusMiles, int maxAgeMinutes);

    [LoggerMessage(Level = LogLevel.Information,
        Message = "AmbientOpenWeatherProvider: configured radius {ConfiguredMiles} mi exceeds API effective limit of {LimitMiles} mi — clamping bounding box query to {LimitMiles} mi.")]
    private static partial void LogRadiusClamped(ILogger logger, double configuredMiles, double limitMiles);

    // ── Response DTOs ─────────────────────────────────────────────────────────

    private sealed record AmbientOpenResponse(
        [property: JsonPropertyName("data")] IReadOnlyList<AmbientOpenStationDto>? Data);

    private sealed record AmbientOpenStationDto(
        [property: JsonPropertyName("macAddress")] string? MacAddress,
        [property: JsonPropertyName("info")] AmbientOpenInfoDto? Info,
        [property: JsonPropertyName("lastData")] AmbientOpenLastDataDto? LastData);

    private sealed record AmbientOpenInfoDto(
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("coords")] AmbientOpenCoordsContainerDto? Coords,
        [property: JsonPropertyName("indoor")] bool? Indoor);

    private sealed record AmbientOpenCoordsContainerDto(
        [property: JsonPropertyName("coords")] AmbientOpenLatLonDto? Coords,
        [property: JsonPropertyName("geo")] AmbientOpenGeoDto? Geo);

    private sealed record AmbientOpenLatLonDto(
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("lat")] double Lat,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("lon")] double Lon);

    private sealed record AmbientOpenGeoDto(
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("coordinates")] IReadOnlyList<double>? Coordinates);

    private sealed record AmbientOpenLastDataDto(
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("dateutc")] long? DateUtc,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("tempf")] double? TempF,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("humidity")] int? Humidity,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("windspeedmph")] double? WindSpeedMph,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("windgustmph")] double? WindGustMph,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("winddir")] int? WindDir,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("baromrelin")] double? BaromRelIn,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("baromabsin")] double? BaromAbsIn,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("hourlyrainin")] double? HourlyRainIn,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("dailyrainin")] double? DailyRainIn,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("weeklyrainin")] double? WeeklyRainIn,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("monthlyrainin")] double? MonthlyRainIn,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("yearlyrainin")] double? YearlyRainIn,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("dewPoint")] double? DewPoint,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("feelsLike")] double? FeelsLike,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("solarradiation")] double? SolarRadiation,
        [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        [property: JsonPropertyName("uv")] int? Uv);
}
