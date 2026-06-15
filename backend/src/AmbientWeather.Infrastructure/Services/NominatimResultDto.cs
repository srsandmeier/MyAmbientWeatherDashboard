using System.Text.Json.Serialization;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>Nominatim geocoding API result.</summary>
internal sealed record NominatimResultDto(
    [property: JsonPropertyName("lat")] string? Lat,
    [property: JsonPropertyName("lon")] string? Lon,
    [property: JsonPropertyName("display_name")] string? DisplayName,
    [property: JsonPropertyName("class")] string? Class,
    [property: JsonPropertyName("type")] string? Type);
