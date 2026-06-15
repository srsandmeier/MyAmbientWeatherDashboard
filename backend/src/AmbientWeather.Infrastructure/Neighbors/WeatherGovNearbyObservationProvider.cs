using System.Globalization;
using System.Net.Http.Json;
using AmbientWeather.Domain.Neighbors;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Discovers nearby NWS observation stations via <c>api.weather.gov</c>.
/// Returns an empty list when the user's coordinates are outside the US bounding box
/// or when any API call fails.
/// Units returned by NWS are SI (°C, km/h, Pa) — converted to °F / mph / inHg here.
/// </summary>
public sealed partial class WeatherGovNearbyObservationProvider(
    IHttpClientFactory httpClientFactory,
    ILogger<WeatherGovNearbyObservationProvider> logger) : INearbyWeatherProvider
{
    internal const string HttpClientName = "WeatherGovRest";
    private const int MaxStations = 3;

    /// <inheritdoc />
    public string ProviderName => "WeatherGov";

    /// <inheritdoc />
    public async Task<IReadOnlyList<NeighborStation>> DiscoverAsync(
        NeighborConfig config,
        CancellationToken cancellationToken = default)
    {
        if (!IsEnabled(config)) return [];

        var lat = config.UserLatitude!.Value;
        var lon = config.UserLongitude!.Value;

        if (!NeighborGeoHelper.IsWithinUsBoundingBox(lat, lon)) return [];

        try
        {
            return await FetchStationsAsync(lat, lon, config, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            LogDiscoveryFailed(logger, ex);
            return [];
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogDiscoveryFailed(logger, ex);
            return [];
        }
    }

    private static bool IsEnabled(NeighborConfig config)
    {
        if (config.UserLatitude is null || config.UserLongitude is null) return false;
        if (!config.IsEnabled) return false;
        return config.EnabledProviders.Count == 0
            || config.EnabledProviders.Contains("WeatherGov", StringComparer.Ordinal);
    }

    private async Task<IReadOnlyList<NeighborStation>> FetchStationsAsync(
        double lat, double lon, NeighborConfig config, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient(HttpClientName);

        var pointsUri = string.Format(CultureInfo.InvariantCulture, "/points/{0:F4},{1:F4}", lat, lon);
        var pointsResponse = await client
            .GetFromJsonAsync<NwsResponseTypes.NwsPointsResponse>(pointsUri, cancellationToken: ct)
            .ConfigureAwait(false);

        var stationsUrl = pointsResponse?.Properties?.ObservationStations;
        if (string.IsNullOrWhiteSpace(stationsUrl)) return [];

        if (!Uri.TryCreate(stationsUrl, UriKind.Absolute, out var stationsUri) ||
            !string.Equals(stationsUri.Host, "api.weather.gov", StringComparison.OrdinalIgnoreCase))
        {
            LogUnexpectedStationsHost(logger, stationsUri?.Host ?? "null");
            return [];
        }

        var stationsResponse = await client
            .GetFromJsonAsync<NwsResponseTypes.NwsStationsResponse>(stationsUri.PathAndQuery, cancellationToken: ct)
            .ConfigureAwait(false);

        var features = stationsResponse?.Features;
        if (features is not { Count: > 0 }) return [];

        var cutoff = DateTime.UtcNow.AddMinutes(-config.MaxAgeMinutes);
        var results = new List<NeighborStation>(MaxStations);

        foreach (var feature in features.Take(MaxStations))
        {
            var station = await TryBuildStationAsync(client, feature, lat, lon, cutoff, ct)
                .ConfigureAwait(false);
            if (station is not null)
                results.Add(station);
        }

        return results;
    }

    private async Task<NeighborStation?> TryBuildStationAsync(
        HttpClient client,
        NwsResponseTypes.NwsStationFeature feature,
        double userLat, double userLon,
        DateTime cutoff,
        CancellationToken ct)
    {
        var stationId = feature.Properties?.StationIdentifier;
        var stationLat = feature.Geometry?.Coordinates?.ElementAtOrDefault(1);
        var stationLon = feature.Geometry?.Coordinates?.ElementAtOrDefault(0);

        if (stationId is null || stationLat is null || stationLon is null) return null;

        var obs = await FetchLatestObservationAsync(client, stationId, ct).ConfigureAwait(false);
        if (obs is null) return null;

        DateTime? observedAt = null;
        if (obs.Properties?.Timestamp is { Length: > 0 } ts &&
            DateTimeOffset.TryParse(ts, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
        {
            observedAt = dto.UtcDateTime;
            if (observedAt < cutoff) return null;
        }

        var tempF = NeighborGeoHelper.CelsiusToF(obs.Properties?.Temperature?.Value);
        var humidity = NeighborGeoHelper.RoundToInt(obs.Properties?.RelativeHumidity?.Value);
        var windSpeedMph = NeighborGeoHelper.KmhToMph(obs.Properties?.WindSpeed?.Value);
        var windGustMph = NeighborGeoHelper.KmhToMph(obs.Properties?.WindGust?.Value);
        var windDir = NeighborGeoHelper.RoundToInt(obs.Properties?.WindDirection?.Value);
        var baromRelIn = NeighborGeoHelper.PaToInHg(obs.Properties?.BarometricPressure?.Value);
        var dewPoint = NeighborGeoHelper.CelsiusToF(obs.Properties?.DewPoint?.Value)
            ?? NeighborGeoHelper.ApproximateDewPointF(tempF, humidity);
        var feelsLike = NeighborGeoHelper.ApproximateFeelsLikeF(tempF, humidity, windSpeedMph);
        var dailyHighF = NeighborGeoHelper.CelsiusToF(obs.Properties?.MaxTemperatureLast24Hours?.Value);
        var dailyLowF = NeighborGeoHelper.CelsiusToF(obs.Properties?.MinTemperatureLast24Hours?.Value);
        var distance = NeighborGeoHelper.HaversineDistanceMiles(
            userLat, userLon, stationLat.Value, stationLon.Value);
        int? freshness = observedAt.HasValue
            ? (int)(DateTime.UtcNow - observedAt.Value).TotalMinutes
            : null;

        return new NeighborStation
        {
            Provider = ProviderName,
            SourceId = stationId,
            Name = feature.Properties?.Name,
            Lat = stationLat.Value,
            Lon = stationLon.Value,
            DistanceMiles = distance,
            LastObservedAtUtc = observedAt,
            FreshnessMinutes = freshness,
            TempF = tempF,
            Humidity = humidity,
            DewPoint = dewPoint,
            FeelsLike = feelsLike,
            BaromRelIn = baromRelIn,
            WindSpeedMph = windSpeedMph,
            WindGustMph = windGustMph,
            WindDir = windDir,
            DailyHighTempF = dailyHighF,
            DailyLowTempF = dailyLowF,
            SkyConditions = NwsTextFormatter.FormatCloudLayers(obs.Properties?.CloudLayers),
            PresentWeather = NwsTextFormatter.FormatPresentWeather(obs.Properties?.PresentWeather),
            TextDescription = obs.Properties?.TextDescription,
            RawMetar = obs.Properties?.RawMessage,
        };
    }

    private static async Task<NwsResponseTypes.NwsObservationResponse?> FetchLatestObservationAsync(
        HttpClient client, string stationId, CancellationToken ct)
    {
        try
        {
            return await client
                .GetFromJsonAsync<NwsResponseTypes.NwsObservationResponse>(
                    $"/stations/{stationId}/observations/latest", cancellationToken: ct)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return null;
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "WeatherGovNearbyObservationProvider: discovery request failed.")]
    private static partial void LogDiscoveryFailed(ILogger logger, Exception ex);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "NWS /points response contained unexpected stations URL host: {Host}")]
    private static partial void LogUnexpectedStationsHost(ILogger logger, string host);

}
