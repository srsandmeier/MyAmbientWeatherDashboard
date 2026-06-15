using System.Text.Json.Serialization;

namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// Represents the device metadata block returned by the Ambient Weather REST API.
/// </summary>
public record DeviceInfoDto
{
    /// <summary>Gets the user-assigned device name.</summary>
    [JsonPropertyName("name")]
    public string? Name { get; init; }

    /// <summary>Gets the location details for the device.</summary>
    [JsonPropertyName("coords")]
    public LocationDetailsDto? LocationDetails { get; init; }
}
