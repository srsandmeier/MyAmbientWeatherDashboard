using System.Text.Json.Serialization;

namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// Response wrapper for the device history endpoint.
/// Represents an array of weather readings from a specific device.
/// </summary>
public record DeviceHistoryResponseDto
{
    /// <summary>Gets the array of weather readings, ordered by most recent first.</summary>
    [JsonPropertyName("readings")]
    public required IReadOnlyList<WeatherReadingDto> Readings { get; init; }

    /// <summary>Gets the total number of readings available from the device.</summary>
    [JsonPropertyName("totalReadings")]
    public int TotalReadings { get; init; }

    /// <summary>Gets the pagination metadata for the current response.</summary>
    [JsonPropertyName("pagination")]
    public PaginationMetadataDto? Pagination { get; init; }
}
