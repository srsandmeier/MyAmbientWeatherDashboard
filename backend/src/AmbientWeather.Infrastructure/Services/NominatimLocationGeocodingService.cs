using System.Globalization;
using System.Net.Http.Json;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Neighbors;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// Resolves user-entered place queries through OpenStreetMap Nominatim.
/// </summary>
public sealed partial class NominatimLocationGeocodingService(
    IHttpClientFactory httpClientFactory,
    ILogger<NominatimLocationGeocodingService> logger) : ILocationGeocodingService
{
    /// <inheritdoc/>
    public async Task<GeocodedLocation?> GeocodeAsync(
        string query,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
            return null;

        try
        {
            var airportLocation = await TryGeocodeAirportCodeAsync(query, cancellationToken).ConfigureAwait(false);
            if (airportLocation is not null)
                return airportLocation;

            var client = httpClientFactory.CreateClient(PublicSourceDiscoveryService.NominatimClientName);
            var uri = $"/search?q={Uri.EscapeDataString(query.Trim())}&format=json&limit=10";
            var results = await client
                .GetFromJsonAsync<IReadOnlyList<NominatimResultDto>>(uri, cancellationToken: cancellationToken)
                .ConfigureAwait(false);

            if (results is not { Count: > 0 }) return null;

            return SelectBestResult(query, results) is { } best
                ? TryMapLocation(best)
                : null;
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            LogGeocodeFailed(logger, ex);
            return null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogGeocodeFailed(logger, ex);
            return null;
        }
    }

    private async Task<GeocodedLocation?> TryGeocodeAirportCodeAsync(
        string query,
        CancellationToken cancellationToken)
    {
        var candidates = GetAirportCodeCandidates(query);
        if (candidates.Count == 0) return null;

        var client = httpClientFactory.CreateClient(WeatherGovNearbyObservationProvider.HttpClientName);
        foreach (var candidate in candidates)
        {
            try
            {
                var response = await client
                    .GetFromJsonAsync<NwsResponseTypes.NwsStationFeature>(
                        $"/stations/{Uri.EscapeDataString(candidate)}",
                        cancellationToken: cancellationToken)
                    .ConfigureAwait(false);
                var coordinates = response?.Geometry?.Coordinates;
                if (coordinates is not { Count: >= 2 }) continue;

                return new GeocodedLocation(
                    coordinates[1],
                    coordinates[0],
                    response?.Properties?.Name ?? candidate);
            }
            catch (HttpRequestException)
            {
                // Try the next likely station identifier, then fall back to Nominatim.
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                // Try the next likely station identifier, then fall back to Nominatim.
            }
        }

        return null;
    }

    private static IReadOnlyList<string> GetAirportCodeCandidates(string query)
    {
        var normalized = query.Trim().ToUpperInvariant();
        if (normalized.Length is < 3 or > 4 || normalized.Any(ch => ch is < 'A' or > 'Z'))
            return [];

        return normalized.Length == 3
            ? [$"K{normalized}", normalized]
            : [normalized];
    }

    private static NominatimResultDto? SelectBestResult(string query, IReadOnlyList<NominatimResultDto> results)
    {
        var isCountyQuery = query.Contains("county", StringComparison.OrdinalIgnoreCase);
        var preferred = isCountyQuery
            ? results.FirstOrDefault(IsCountyResult)
            : results.FirstOrDefault(IsCityResult);

        return preferred ?? results[0];
    }

    private static GeocodedLocation? TryMapLocation(NominatimResultDto result)
    {
        if (!double.TryParse(result.Lat, NumberStyles.Float, CultureInfo.InvariantCulture, out var lat) ||
            !double.TryParse(result.Lon, NumberStyles.Float, CultureInfo.InvariantCulture, out var lon))
        {
            return null;
        }

        return new GeocodedLocation(lat, lon, result.DisplayName);
    }

    private static bool IsCityResult(NominatimResultDto result)
    {
        var category = result.Class?.Trim().ToLowerInvariant();
        var type = result.Type?.Trim().ToLowerInvariant();
        return string.Equals(category, "place", StringComparison.Ordinal)
            && type is "city" or "town" or "village" or "hamlet" or "municipality";
    }

    private static bool IsCountyResult(NominatimResultDto result)
    {
        var category = result.Class?.Trim().ToLowerInvariant();
        var type = result.Type?.Trim().ToLowerInvariant();
        return string.Equals(category, "boundary", StringComparison.Ordinal)
            && type is "administrative" or "county";
    }

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "NominatimLocationGeocodingService: geocoding request failed.")]
    private static partial void LogGeocodeFailed(ILogger logger, Exception ex);
}
