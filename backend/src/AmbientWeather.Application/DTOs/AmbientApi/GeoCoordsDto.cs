using System.Text.Json.Serialization;

namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// Represents a WGS-84 longitude/latitude coordinate pair.
/// </summary>
public record GeoCoordsDto
{
    /// <summary>Gets the longitude in decimal degrees.</summary>
    [JsonPropertyName("lon")]
    public double Lon { get; init; }

    /// <summary>Gets the latitude in decimal degrees.</summary>
    [JsonPropertyName("lat")]
    public double Lat { get; init; }
}
