using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using AmbientWeather.Application.DTOs.PublicSources;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Neighbors;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// Geocodes a search query via Nominatim, then resolves nearby NWS observation stations
/// and returns an Open-Meteo grid entry for the same coordinates.
/// </summary>
public sealed partial class PublicSourceDiscoveryService(
    IHttpClientFactory httpClientFactory,
    ILogger<PublicSourceDiscoveryService> logger) : IPublicSourceDiscoveryService
{
    internal const string NominatimClientName = "Nominatim";
    private const int MaxNwsStations = 5;
    private const int MaxOpenMeteoPlaces = 6;

    /// <inheritdoc/>
    public async Task<IReadOnlyList<DiscoveredPublicSourceDto>> DiscoverAsync(
        string searchQuery,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await FetchAsync(searchQuery, cancellationToken).ConfigureAwait(false);
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

    // CreatePublicWeatherSourceCommandValidator enforces MaximumLength(128) on DisplayLabel.
    // "Open-Meteo — " is 13 chars; leave 115 for the location hint.
    private const int MaxLocationHintLength = 115;

    private async Task<IReadOnlyList<DiscoveredPublicSourceDto>> FetchAsync(
        string searchQuery,
        CancellationToken ct)
    {
        var geocodedPlaces = await GeocodeAsync(searchQuery, ct).ConfigureAwait(false);
        if (geocodedPlaces.Count == 0) return [];

        var primaryPlace = geocodedPlaces[0];

        var results = new List<DiscoveredPublicSourceDto>();

        var nwsStations = await FetchNwsStationsAsync(primaryPlace.Lat, primaryPlace.Lon, ct).ConfigureAwait(false);
        results.AddRange(nwsStations);

        foreach (var place in geocodedPlaces.Take(MaxOpenMeteoPlaces))
        {
            var openMeteoTimezone = await ResolveOpenMeteoTimezoneAsync(place.Lat, place.Lon, ct).ConfigureAwait(false);
            results.Add(new DiscoveredPublicSourceDto
            {
                Provider = "OpenMeteo",
                SourceId = string.Format(CultureInfo.InvariantCulture, "{0:F4},{1:F4}", place.Lat, place.Lon),
                DisplayLabel = $"Open-Meteo — {BuildLocationHint(place)}",
                Latitude = place.Lat,
                Longitude = place.Lon,
                Timezone = openMeteoTimezone,
            });
        }

        return results;
    }

    private async Task<IReadOnlyList<GeocodedPlace>> GeocodeAsync(string query, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient(NominatimClientName);
        // countrycodes=us is intentionally absent: Open-Meteo is a global provider, so the
        // geocoder must resolve non-US locations too. FetchNwsStationsAsync guards NWS calls
        // to US coordinates via IsWithinUsBoundingBox.
        var uri = $"/search?q={Uri.EscapeDataString(query)}&format=json&addressdetails=1&limit=10";

        var results = await client
            .GetFromJsonAsync<IReadOnlyList<NominatimResultDto>>(uri, cancellationToken: ct)
            .ConfigureAwait(false);

        if (results is not { Count: > 0 }) return [];

        var places = results
            .Where(IsCandidatePlace)
            .Select(TryMapGeocodedPlace)
            .OfType<GeocodedPlace>()
            .DistinctBy(place => place.SourceId)
            .ToList();

        if (places.Count > 0) return places;

        var fallback = TryMapGeocodedPlace(results[0]);
        return fallback is null ? [] : [fallback];
    }

    private static GeocodedPlace? TryMapGeocodedPlace(NominatimResultDto result)
    {
        if (!double.TryParse(result.Lat, NumberStyles.Float, CultureInfo.InvariantCulture, out var lat) ||
            !double.TryParse(result.Lon, NumberStyles.Float, CultureInfo.InvariantCulture, out var lon))
        {
            return null;
        }

        var sourceId = string.Format(CultureInfo.InvariantCulture, "{0:F4},{1:F4}", lat, lon);
        return new GeocodedPlace(lat, lon, sourceId, result.DisplayName);
    }

    private static bool IsCandidatePlace(NominatimResultDto result)
    {
        if (string.IsNullOrWhiteSpace(result.Class) && string.IsNullOrWhiteSpace(result.Type))
            return true;

        var category = result.Class?.Trim().ToLowerInvariant();
        var type = result.Type?.Trim().ToLowerInvariant();

        return category is "place" or "boundary"
            || type is "city" or "town" or "village" or "hamlet" or "locality"
                or "suburb" or "municipality" or "county" or "administrative";
    }

    private static string BuildLocationHint(GeocodedPlace place)
    {
        if (string.IsNullOrWhiteSpace(place.PlaceName))
            return string.Format(CultureInfo.InvariantCulture, "{0:F3}, {1:F3}", place.Lat, place.Lon);

        return place.PlaceName.Length > MaxLocationHintLength
            ? string.Concat(place.PlaceName.AsSpan(0, MaxLocationHintLength), "…")
            : place.PlaceName;
    }

    private async Task<string?> ResolveOpenMeteoTimezoneAsync(double lat, double lon, CancellationToken ct)
    {
        try
        {
            var client = httpClientFactory.CreateClient(OpenMeteoNearbyBaselineProvider.HttpClientName);
            var uri = OpenMeteoUriBuilder.BuildTimezoneProbe(lat, lon);

            var response = await client
                .GetFromJsonAsync<OpenMeteoLocationResponse>(uri, cancellationToken: ct)
                .ConfigureAwait(false);

            return string.IsNullOrWhiteSpace(response?.Timezone) ? null : response.Timezone;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return null;
        }
    }

    private async Task<IReadOnlyList<DiscoveredPublicSourceDto>> FetchNwsStationsAsync(
        double lat, double lon, CancellationToken ct)
    {
        if (!NeighborGeoHelper.IsWithinUsBoundingBox(lat, lon)) return [];

        var client = httpClientFactory.CreateClient(WeatherGovNearbyObservationProvider.HttpClientName);

        var pointsUri = string.Format(CultureInfo.InvariantCulture, "/points/{0:F4},{1:F4}", lat, lon);
        NwsResponseTypes.NwsPointsResponse? pointsResponse;
        try
        {
            pointsResponse = await client
                .GetFromJsonAsync<NwsResponseTypes.NwsPointsResponse>(pointsUri, cancellationToken: ct)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return [];
        }
        catch (HttpRequestException)
        {
            return [];
        }

        var stationsUri = TryGetNwsStationsUri(pointsResponse);
        if (stationsUri is null) return [];

        NwsResponseTypes.NwsStationsResponse? stationsResponse;
        try
        {
            stationsResponse = await client
                .GetFromJsonAsync<NwsResponseTypes.NwsStationsResponse>(stationsUri.PathAndQuery, cancellationToken: ct)
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return [];
        }
        catch (HttpRequestException)
        {
            return [];
        }

        var features = stationsResponse?.Features;
        if (features is not { Count: > 0 }) return [];

        return features
            .Take(MaxNwsStations)
            .Where(f => f.Properties?.StationIdentifier is not null)
            .Select(f => new DiscoveredPublicSourceDto
            {
                Provider = "WeatherGov",
                SourceId = f.Properties!.StationIdentifier!,
                DisplayLabel = f.Properties.Name ?? f.Properties.StationIdentifier!,
                Latitude = f.Geometry?.Coordinates?.ElementAtOrDefault(1) ?? lat,
                Longitude = f.Geometry?.Coordinates?.ElementAtOrDefault(0) ?? lon,
            })
            .ToList();
    }

    private Uri? TryGetNwsStationsUri(NwsResponseTypes.NwsPointsResponse? pointsResponse)
    {
        var stationsUrl = pointsResponse?.Properties?.ObservationStations;
        if (string.IsNullOrWhiteSpace(stationsUrl)) return null;

        if (Uri.TryCreate(stationsUrl, UriKind.Absolute, out var stationsUri) &&
            string.Equals(stationsUri.Host, "api.weather.gov", StringComparison.OrdinalIgnoreCase))
        {
            return stationsUri;
        }

        LogUnexpectedStationsHost(logger, stationsUri?.Host ?? "null");
        return null;
    }

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "PublicSourceDiscoveryService: discovery request failed.")]
    private static partial void LogDiscoveryFailed(ILogger logger, Exception ex);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "NWS /points response contained unexpected stations URL host: {Host}")]
    private static partial void LogUnexpectedStationsHost(ILogger logger, string host);

    private sealed record GeocodedPlace(
        double Lat,
        double Lon,
        string SourceId,
        string? PlaceName);

    private sealed record OpenMeteoLocationResponse(
        [property: JsonPropertyName("timezone")] string? Timezone);
}
