using System.Text.Json;
using AmbientWeather.Domain.Neighbors;

namespace AmbientWeather.Application.DTOs.Neighbors;

/// <summary>
/// Shared JSON options and deserialization helper for <see cref="NeighborConfig"/>.
/// </summary>
internal static class NeighborConfigJsonOptions
{
    /// <summary>
    /// CamelCase, case-insensitive read — matches the JavaScript property naming used in the
    /// stored JSON and in the BFF API response.
    /// </summary>
    internal static readonly JsonSerializerOptions Default = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>
    /// Deserializes <paramref name="json"/> to a <see cref="NeighborConfig"/>, returning
    /// defaults when the value is absent, empty, or malformed.
    /// </summary>
    internal static NeighborConfig Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)
            || string.Equals(json, "{}", StringComparison.Ordinal))
            return new NeighborConfig();

        try
        {
            return JsonSerializer.Deserialize<NeighborConfig>(json, Default)
                ?? new NeighborConfig();
        }
        catch (JsonException)
        {
            return new NeighborConfig();
        }
    }
}
