using System.Text.Json.Serialization;

namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// Represents a device returned by the Ambient Weather REST API.
/// </summary>
public record DeviceDto
{
    /// <summary>Gets the MAC address of the device.</summary>
    [JsonPropertyName("macAddress")]
    public required string MacAddress { get; init; }

    /// <summary>Gets the most recent sensor readings for the device.</summary>
    [JsonPropertyName("lastData")]
    public required DeviceDataDto LastData { get; init; }

    /// <summary>Gets the device metadata such as name and location.</summary>
    [JsonPropertyName("info")]
    public required DeviceInfoDto Info { get; init; }
}
