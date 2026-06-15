using System.Text.Json.Serialization;

namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Shared JSON response record types for the <c>api.weather.gov</c> REST API.
/// Used by <see cref="WeatherGovNearbyObservationProvider"/>,
/// <see cref="Services.PublicSourceDiscoveryService"/>, and
/// <see cref="PublicSources.PublicSourceCurrentReadingService"/>.
/// </summary>
internal static class NwsResponseTypes
{
    internal sealed record NwsPointsResponse(
        [property: JsonPropertyName("properties")] NwsPointsProperties? Properties);

    internal sealed record NwsPointsProperties(
        [property: JsonPropertyName("observationStations")] string? ObservationStations);

    internal sealed record NwsStationsResponse(
        [property: JsonPropertyName("features")] IReadOnlyList<NwsStationFeature>? Features);

    internal sealed record NwsStationFeature(
        [property: JsonPropertyName("geometry")] NwsGeometry? Geometry,
        [property: JsonPropertyName("properties")] NwsStationProperties? Properties);

    internal sealed record NwsGeometry(
        [property: JsonPropertyName("coordinates")] IReadOnlyList<double>? Coordinates);

    internal sealed record NwsStationProperties(
        [property: JsonPropertyName("stationIdentifier")] string? StationIdentifier,
        [property: JsonPropertyName("name")] string? Name);

    internal sealed record NwsObservationResponse(
        [property: JsonPropertyName("properties")] NwsObservationProperties? Properties);

    internal sealed record NwsObservationProperties(
        [property: JsonPropertyName("timestamp")] string? Timestamp,
        [property: JsonPropertyName("temperature")] NwsMeasurement? Temperature,
        [property: JsonPropertyName("dewpoint")] NwsMeasurement? DewPoint,
        [property: JsonPropertyName("relativeHumidity")] NwsMeasurement? RelativeHumidity,
        [property: JsonPropertyName("windDirection")] NwsMeasurement? WindDirection,
        [property: JsonPropertyName("windSpeed")] NwsMeasurement? WindSpeed,
        [property: JsonPropertyName("windGust")] NwsMeasurement? WindGust,
        [property: JsonPropertyName("barometricPressure")] NwsMeasurement? BarometricPressure,
        [property: JsonPropertyName("maxTemperatureLast24Hours")] NwsMeasurement? MaxTemperatureLast24Hours,
        [property: JsonPropertyName("minTemperatureLast24Hours")] NwsMeasurement? MinTemperatureLast24Hours,
        [property: JsonPropertyName("textDescription")] string? TextDescription,
        [property: JsonPropertyName("rawMessage")] string? RawMessage,
        [property: JsonPropertyName("cloudLayers")] IReadOnlyList<NwsCloudLayer>? CloudLayers,
        [property: JsonPropertyName("presentWeather")] IReadOnlyList<NwsPresentWeatherItem>? PresentWeather);

    internal sealed record NwsMeasurement(
        [property: JsonPropertyName("value")] double? Value);

    /// <summary>A single cloud layer entry from an NWS observation (e.g., FEW @ 1,800ft).</summary>
    internal sealed record NwsCloudLayer(
        [property: JsonPropertyName("coverage")] string? Coverage,
        [property: JsonPropertyName("baseHeight")] NwsMeasurement? BaseHeight);

    /// <summary>A single present-weather phenomenon entry from an NWS observation.</summary>
    internal sealed record NwsPresentWeatherItem(
        [property: JsonPropertyName("rawString")] string? RawString);
}
