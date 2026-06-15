using System.Text.Json.Serialization;

namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// Payload of the Ambient Weather Socket.IO <c>data</c> event.
/// Structurally identical to <see cref="DeviceDataDto"/> with the addition of the
/// device MAC address, which routes the event to the owning user.
/// </summary>
public record AmbientRealtimeDataDto : DeviceDataDto
{
    /// <summary>Gets the MAC address of the station that produced this reading.</summary>
    [JsonPropertyName("macAddress")]
    public string? MacAddress { get; init; }
}
