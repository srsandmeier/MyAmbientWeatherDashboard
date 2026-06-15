using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using AmbientWeather.Domain.Neighbors;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Provides a single model-grid baseline reading at the user's coordinates from
/// <c>api.open-meteo.com</c>. No API key required. Global coverage.
/// Returns an empty list rather than throwing on any API failure.
/// </summary>
public sealed partial class OpenMeteoNearbyBaselineProvider(
    IHttpClientFactory httpClientFactory,
    ILogger<OpenMeteoNearbyBaselineProvider> logger) : INearbyWeatherProvider
{
    internal const string HttpClientName = "OpenMeteoRest";
    internal const string OverpassClientName = "Overpass";
    private const int MaxFetchCandidates = 8;

    /// <inheritdoc />
    public string ProviderName => "OpenMeteo";

    /// <inheritdoc />
    public async Task<IReadOnlyList<NeighborStation>> DiscoverAsync(
        NeighborConfig config,
        CancellationToken cancellationToken = default)
    {
        if (!IsEnabled(config)) return [];

        var lat = config.UserLatitude!.Value;
        var lon = config.UserLongitude!.Value;

        var places = await GetOpenMeteoPlacesAsync(config, lat, lon, cancellationToken).ConfigureAwait(false);
        if (places.Count == 0 && string.Equals(config.DiscoveryCacheScope, "finder", StringComparison.Ordinal))
            return [];

        if (places.Count == 0)
            places = [new OpenMeteoPlace(lat, lon, config.UserLocationLabel ?? "Open-Meteo model grid", "station-location")];

        var fetchTasks = places.Take(MaxFetchCandidates)
            .Select(p => GetStationAsync(p, lat, lon, cancellationToken));
        var stationResults = await Task.WhenAll(fetchTasks).ConfigureAwait(false);
        return [.. stationResults.OfType<NeighborStation>()];
    }

    private async Task<NeighborStation?> GetStationAsync(
        OpenMeteoPlace place,
        double userLat,
        double userLon,
        CancellationToken cancellationToken)
    {
        OpenMeteoResponse? response;
        try
        {
            var uri = BuildUri(place.Lat, place.Lon);
            var client = httpClientFactory.CreateClient(HttpClientName);
            response = await client
                .GetFromJsonAsync<OpenMeteoResponse>(uri, cancellationToken: cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogDiscoveryFailed(logger, ex);
            return null;
        }

        return MapToStation(response, userLat, userLon, place);
    }

    private static bool IsEnabled(NeighborConfig config)
    {
        if (config.UserLatitude is null || config.UserLongitude is null) return false;
        if (!config.IsEnabled) return false;
        return config.EnabledProviders.Count == 0
            || config.EnabledProviders.Contains("OpenMeteo", StringComparer.Ordinal);
    }

    private static string BuildUri(double lat, double lon) =>
        OpenMeteoUriBuilder.BuildNeighborBaseline(lat, lon);

    private NeighborStation? MapToStation(
        OpenMeteoResponse? response,
        double userLat,
        double userLon,
        OpenMeteoPlace place)
    {
        var current = response?.Current;
        if (current is null) return null;

        var tempF = current.Temperature2m;
        var humidity = current.RelativeHumidity2m is { } rh ? (int?)rh : null;
        var windDir = current.WindDirection10m is { } wd ? (int?)wd : null;
        var baromRelIn = current.SurfacePressure is { } sp ? sp * 0.029530 : (double?)null;
        // Prefer the API-provided dew point; fall back to Magnus-formula approximation.
        var dewPoint = current.DewPoint2m ?? NeighborGeoHelper.ApproximateDewPointF(tempF, humidity);
        var uv = current.UvIndex is { } uvi ? (int?)Math.Round(uvi) : null;
        var daily = response?.Daily;
        var hourly = response?.Hourly;

        return new NeighborStation
        {
            Provider = ProviderName,
            SourceId = string.Format(CultureInfo.InvariantCulture,
                "open-meteo:{0:F4},{1:F4}", place.Lat, place.Lon),
            Name = string.IsNullOrWhiteSpace(place.Name)
                ? "Open-Meteo model grid"
                : place.Name.Trim(),
            DiscoveryKind = place.Kind,
            Lat = response?.Latitude ?? place.Lat,
            Lon = response?.Longitude ?? place.Lon,
            DistanceMiles = NeighborGeoHelper.HaversineDistanceMiles(userLat, userLon, place.Lat, place.Lon),
            // Open-Meteo is a model-grid baseline at the requested coordinates, not a
            // physical station observation. Use discovery time so the shared station-age
            // filter does not discard it for half of every hour when MaxAgeMinutes is 30.
            LastObservedAtUtc = DateTime.UtcNow,
            FreshnessMinutes = 0,
            TempF = tempF,
            Humidity = humidity,
            DewPoint = dewPoint,
            FeelsLike = current.ApparentTemperature,
            BaromRelIn = baromRelIn,
            WindSpeedMph = current.WindSpeed10m,
            WindGustMph = current.WindGusts10m,
            WindDir = windDir,
            HourlyRainIn = current.Precipitation,
            Uv = uv,
            DailyHighTempF = daily?.TemperatureMax?.ElementAtOrDefault(0),
            DailyLowTempF = daily?.TemperatureMin?.ElementAtOrDefault(0),
            OmCloudCover = current.CloudCover,
            OmPrecipProbability = hourly?.PrecipitationProbability?.ElementAtOrDefault(0),
            OmWeatherDescription = WmoWeatherDescriptions.Describe(current.WeatherCode),
            OmSunrise = OpenMeteoLocalTime.Format(daily?.Sunrise?.ElementAtOrDefault(0)),
            OmSunset = OpenMeteoLocalTime.Format(daily?.Sunset?.ElementAtOrDefault(0)),
            OmUvIndexMax = daily?.UvIndexMax?.ElementAtOrDefault(0) is { } uvMax ? (int?)Math.Round(uvMax) : null,
            OmPrecipSumIn = daily?.PrecipitationSum?.ElementAtOrDefault(0),
            OmWindSpeedMax = daily?.WindSpeedMax?.ElementAtOrDefault(0),
            OmWindGustMax = daily?.WindGustsMax?.ElementAtOrDefault(0),
            OmWindDirDominant = daily?.WindDirectionDominant?.ElementAtOrDefault(0) is { } wdd ? (int?)Math.Round(wdd) : null,
        };
    }

    private async Task<IReadOnlyList<OpenMeteoPlace>> GetOpenMeteoPlacesAsync(
        NeighborConfig config,
        double lat,
        double lon,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(config.DiscoveryCacheScope, "finder", StringComparison.Ordinal))
            return [];

        try
        {
            var meters = Math.Max(1, (int)Math.Round(config.RadiusMiles * 1609.344));
            var searchContext = ClassifySearch(config);
            var query = BuildOverpassQuery(lat, lon, meters);
            var client = httpClientFactory.CreateClient(OverpassClientName);
            var response = await client
                .GetFromJsonAsync<OverpassResponse>($"/api/interpreter?data={Uri.EscapeDataString(query)}", cancellationToken)
                .ConfigureAwait(false);

            return MapOverpassPlaces(response, lat, lon, config.RadiusMiles, searchContext);
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            LogPlaceDiscoveryFailed(logger, ex);
            return [];
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogPlaceDiscoveryFailed(logger, ex);
            return [];
        }
    }

    private static OpenMeteoSearchContext ClassifySearch(NeighborConfig config)
    {
        var query = config.DiscoveryLocationQuery?.Trim();
        if (string.IsNullOrWhiteSpace(query))
            return new OpenMeteoSearchContext(OpenMeteoSearchMode.StationLocation);

        var normalized = query.Replace(".", string.Empty, StringComparison.Ordinal).Trim();
        if (normalized.Length is 3 or 4 && normalized.All(char.IsLetter))
            return new OpenMeteoSearchContext(OpenMeteoSearchMode.Airport);

        var parts = TryParseLocationParts(normalized);
        var mode = normalized.Contains("county", StringComparison.OrdinalIgnoreCase)
            ? OpenMeteoSearchMode.County
            : OpenMeteoSearchMode.City;

        return new OpenMeteoSearchContext(mode, parts?.PlaceName, parts?.StateName);
    }

    private static string BuildOverpassQuery(double lat, double lon, int radiusMeters) =>
        string.Format(
            CultureInfo.InvariantCulture,
            """
            [out:json][timeout:15];
            (
              node["place"~"^(city|town|village)$"](around:{0},{1:F6},{2:F6});
              relation["boundary"="administrative"]["admin_level"~"^(6|7|8)$"](around:{0},{1:F6},{2:F6});
              node["aeroway"="aerodrome"](around:{0},{1:F6},{2:F6});
              way["aeroway"="aerodrome"](around:{0},{1:F6},{2:F6});
              relation["aeroway"="aerodrome"](around:{0},{1:F6},{2:F6});
            );
            out center tags;
            """,
            radiusMeters,
            lat,
            lon);

    private static List<OpenMeteoPlace> MapOverpassPlaces(
        OverpassResponse? response,
        double userLat,
        double userLon,
        double radiusMiles,
        OpenMeteoSearchContext context)
    {
        if (response?.Elements is not { Count: > 0 }) return [];

        var candidates = response.Elements
            .Select(TryMapOverpassPlace)
            .OfType<OpenMeteoPlace>()
            .DistinctBy(place => NormalizeDedupeKey(place))
            .Select(place => new
            {
                Place = place,
                Distance = NeighborGeoHelper.HaversineDistanceMiles(userLat, userLon, place.Lat, place.Lon),
            })
            .Where(item => ShouldKeepPlace(item.Distance, radiusMiles))
            .ToList();

        var nearestCityDistance = candidates
            .Where(item => string.Equals(item.Place.Kind, "city", StringComparison.Ordinal))
            .Select(item => item.Distance)
            .DefaultIfEmpty(double.NaN)
            .Min();

        return candidates
            .OrderBy(item => DiscoveryKindPriority(
                context.Mode,
                item.Place.Kind,
                IsSearchedCity(item.Place, context.PlaceName),
                IsNearestCity(item.Place.Kind, item.Distance, nearestCityDistance)))
            .ThenBy(item => item.Distance)
            .Select(item => item.Place)
            .ToList();
    }

    private static bool ShouldKeepPlace(double distanceMiles, double radiusMiles) =>
        distanceMiles <= radiusMiles;

    private static bool IsNearestCity(string? kind, double distanceMiles, double nearestCityDistance) =>
        string.Equals(kind, "city", StringComparison.Ordinal)
        && !double.IsNaN(nearestCityDistance)
        && Math.Abs(distanceMiles - nearestCityDistance) < 0.001;

    private static bool IsSearchedCity(OpenMeteoPlace place, string? searchedName) =>
        string.Equals(place.Kind, "city", StringComparison.Ordinal)
        && !string.IsNullOrWhiteSpace(searchedName)
        && string.Equals(NormalizePlaceName(place.Name), NormalizePlaceName(searchedName), StringComparison.OrdinalIgnoreCase);

    private static string NormalizePlaceName(string value)
    {
        var name = value;
        var codeStart = name.LastIndexOf(" (", StringComparison.Ordinal);
        if (codeStart > 0)
            name = name[..codeStart];

        return string.Join(' ', name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static int DiscoveryKindPriority(
        OpenMeteoSearchMode searchMode,
        string? kind,
        bool isSearchedCity,
        bool isNearestCity) =>
        searchMode switch
        {
            OpenMeteoSearchMode.City => kind switch
            {
                "city" when isSearchedCity || isNearestCity => 0,
                "county" => 1,
                "airport" => 2,
                "city" => 3,
                _ => 3,
            },
            OpenMeteoSearchMode.County => kind switch
            {
                "county" => 0,
                "city" => 1,
                "airport" => 2,
                _ => 3,
            },
            OpenMeteoSearchMode.Airport => kind switch
            {
                "airport" => 0,
                "city" => 1,
                "county" => 2,
                _ => 3,
            },
            _ => 0,
        };

    private static OpenMeteoPlace? TryMapOverpassPlace(OverpassElement element)
    {
        var lat = element.Lat ?? element.Center?.Lat;
        var lon = element.Lon ?? element.Center?.Lon;
        var name = element.Tags?.DisplayName();
        if (lat is null || lon is null || string.IsNullOrWhiteSpace(name))
            return null;

        return new OpenMeteoPlace(lat.Value, lon.Value, name.Trim(), element.Tags?.DiscoveryKind());
    }

    private static string NormalizeDedupeKey(OpenMeteoPlace place)
    {
        var normalizedName = string.Join(
            ' ',
            place.Name.Trim().ToUpperInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));

        return string.Format(
            CultureInfo.InvariantCulture,
            "{0}:{1:F4},{2:F4}:{3}",
            place.Kind ?? "place",
            place.Lat,
            place.Lon,
            normalizedName);
    }

    private static (string PlaceName, string StateName)? TryParseLocationParts(string query)
    {
        var parts = query.Split(',', 2, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2 || string.IsNullOrWhiteSpace(parts[0]) || string.IsNullOrWhiteSpace(parts[1]))
            return null;

        return TryNormalizeState(parts[1]) is { } stateName
            ? (parts[0], stateName)
            : null;
    }

    private static string? TryNormalizeState(string state)
    {
        var normalized = state.Trim();
        if (StateNamesByAbbreviation.TryGetValue(normalized, out var stateName))
            return stateName;

        return StateNames.Contains(normalized) ? normalized : null;
    }

    private static readonly Dictionary<string, string> StateNamesByAbbreviation = new(StringComparer.OrdinalIgnoreCase)
    {
        ["AL"] = "Alabama",
        ["AK"] = "Alaska",
        ["AZ"] = "Arizona",
        ["AR"] = "Arkansas",
        ["CA"] = "California",
        ["CO"] = "Colorado",
        ["CT"] = "Connecticut",
        ["DE"] = "Delaware",
        ["FL"] = "Florida",
        ["GA"] = "Georgia",
        ["HI"] = "Hawaii",
        ["ID"] = "Idaho",
        ["IL"] = "Illinois",
        ["IN"] = "Indiana",
        ["IA"] = "Iowa",
        ["KS"] = "Kansas",
        ["KY"] = "Kentucky",
        ["LA"] = "Louisiana",
        ["ME"] = "Maine",
        ["MD"] = "Maryland",
        ["MA"] = "Massachusetts",
        ["MI"] = "Michigan",
        ["MN"] = "Minnesota",
        ["MS"] = "Mississippi",
        ["MO"] = "Missouri",
        ["MT"] = "Montana",
        ["NE"] = "Nebraska",
        ["NV"] = "Nevada",
        ["NH"] = "New Hampshire",
        ["NJ"] = "New Jersey",
        ["NM"] = "New Mexico",
        ["NY"] = "New York",
        ["NC"] = "North Carolina",
        ["ND"] = "North Dakota",
        ["OH"] = "Ohio",
        ["OK"] = "Oklahoma",
        ["OR"] = "Oregon",
        ["PA"] = "Pennsylvania",
        ["RI"] = "Rhode Island",
        ["SC"] = "South Carolina",
        ["SD"] = "South Dakota",
        ["TN"] = "Tennessee",
        ["TX"] = "Texas",
        ["UT"] = "Utah",
        ["VT"] = "Vermont",
        ["VA"] = "Virginia",
        ["WA"] = "Washington",
        ["WV"] = "West Virginia",
        ["WI"] = "Wisconsin",
        ["WY"] = "Wyoming",
        ["DC"] = "District of Columbia",
    };

    private static readonly HashSet<string> StateNames = new(
        StateNamesByAbbreviation.Values,
        StringComparer.OrdinalIgnoreCase);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "OpenMeteoNearbyBaselineProvider: discovery request failed.")]
    private static partial void LogDiscoveryFailed(ILogger logger, Exception ex);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "OpenMeteoNearbyBaselineProvider: nearby place discovery failed.")]
    private static partial void LogPlaceDiscoveryFailed(ILogger logger, Exception ex);

    // ── Response DTOs ─────────────────────────────────────────────────────────

    private sealed record OpenMeteoResponse(
        [property: JsonPropertyName("latitude")] double? Latitude,
        [property: JsonPropertyName("longitude")] double? Longitude,
        [property: JsonPropertyName("current")] OpenMeteoCurrent? Current,
        [property: JsonPropertyName("hourly")] OpenMeteoHourlyData? Hourly,
        [property: JsonPropertyName("daily")] OpenMeteoDailyData? Daily);

    private sealed record OpenMeteoPlace(double Lat, double Lon, string Name, string? Kind = null);

    private sealed record OpenMeteoSearchContext(
        OpenMeteoSearchMode Mode,
        string? PlaceName = null,
        string? StateName = null);

    private enum OpenMeteoSearchMode
    {
        StationLocation,
        City,
        County,
        Airport,
    }

    private sealed record OpenMeteoHourlyData(
        [property: JsonPropertyName("precipitation_probability")] IReadOnlyList<int?>? PrecipitationProbability);

    private sealed record OpenMeteoDailyData(
        [property: JsonPropertyName("temperature_2m_max")] IReadOnlyList<double?>? TemperatureMax,
        [property: JsonPropertyName("temperature_2m_min")] IReadOnlyList<double?>? TemperatureMin,
        [property: JsonPropertyName("uv_index_max")] IReadOnlyList<double?>? UvIndexMax,
        [property: JsonPropertyName("precipitation_sum")] IReadOnlyList<double?>? PrecipitationSum,
        [property: JsonPropertyName("sunrise")] IReadOnlyList<string?>? Sunrise,
        [property: JsonPropertyName("sunset")] IReadOnlyList<string?>? Sunset,
        [property: JsonPropertyName("wind_speed_10m_max")] IReadOnlyList<double?>? WindSpeedMax,
        [property: JsonPropertyName("wind_gusts_10m_max")] IReadOnlyList<double?>? WindGustsMax,
        [property: JsonPropertyName("wind_direction_10m_dominant")] IReadOnlyList<double?>? WindDirectionDominant);

    private sealed record OpenMeteoCurrent(
        [property: JsonPropertyName("time")] string? Time,
        [property: JsonPropertyName("temperature_2m")] double? Temperature2m,
        [property: JsonPropertyName("relative_humidity_2m")] double? RelativeHumidity2m,
        [property: JsonPropertyName("apparent_temperature")] double? ApparentTemperature,
        [property: JsonPropertyName("dew_point_2m")] double? DewPoint2m,
        [property: JsonPropertyName("wind_speed_10m")] double? WindSpeed10m,
        [property: JsonPropertyName("wind_direction_10m")] double? WindDirection10m,
        [property: JsonPropertyName("wind_gusts_10m")] double? WindGusts10m,
        [property: JsonPropertyName("surface_pressure")] double? SurfacePressure,
        [property: JsonPropertyName("precipitation")] double? Precipitation,
        [property: JsonPropertyName("uv_index")] double? UvIndex,
        [property: JsonPropertyName("weather_code")] int? WeatherCode,
        [property: JsonPropertyName("cloud_cover")] int? CloudCover);

    private sealed record OverpassResponse(
        [property: JsonPropertyName("elements")] IReadOnlyList<OverpassElement>? Elements);

    private sealed record OverpassElement(
        [property: JsonPropertyName("lat")] double? Lat,
        [property: JsonPropertyName("lon")] double? Lon,
        [property: JsonPropertyName("center")] OverpassCenter? Center,
        [property: JsonPropertyName("tags")] OverpassTags? Tags);

    private sealed record OverpassCenter(
        [property: JsonPropertyName("lat")] double? Lat,
        [property: JsonPropertyName("lon")] double? Lon);

    private sealed record OverpassTags(
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("place")] string? Place,
        [property: JsonPropertyName("boundary")] string? Boundary,
        [property: JsonPropertyName("admin_level")] string? AdminLevel,
        [property: JsonPropertyName("aeroway")] string? Aeroway,
        [property: JsonPropertyName("iata")] string? Iata,
        [property: JsonPropertyName("icao")] string? Icao)
    {
        public string? DisplayName()
        {
            if (string.IsNullOrWhiteSpace(Name))
                return null;

            var code = string.IsNullOrWhiteSpace(Iata) ? Icao : Iata;
            return string.IsNullOrWhiteSpace(code)
                ? Name.Trim()
                : string.Create(
                    CultureInfo.InvariantCulture,
                    $"{Name.Trim()} ({code.Trim().ToUpperInvariant()})");
        }

        public string? DiscoveryKind()
        {
            if (string.Equals(Aeroway, "aerodrome", StringComparison.OrdinalIgnoreCase))
                return "airport";

            if (string.Equals(Boundary, "administrative", StringComparison.OrdinalIgnoreCase)
                && AdminLevel is "6" or "7")
                return "county";

            if (!string.IsNullOrWhiteSpace(Place))
                return "city";

            return null;
        }
    }
}
