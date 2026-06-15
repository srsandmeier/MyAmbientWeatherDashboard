using System.Text.Json.Serialization;

namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// Represents the location details block returned inside device info.
/// </summary>
public record LocationDetailsDto
{
    /// <summary>Gets the geographic coordinates.</summary>
    [JsonPropertyName("coords")]
    public GeoCoordsDto? Coords { get; init; }

    /// <summary>Gets the formatted street address.</summary>
    [JsonPropertyName("address")]
    public string? Address { get; init; }

    /// <summary>Gets the user-defined location label.</summary>
    [JsonPropertyName("location")]
    public string? Location { get; init; }

    /// <summary>Gets the elevation in meters.</summary>
    [JsonPropertyName("elevation")]
    public double? Elevation { get; init; }
}
