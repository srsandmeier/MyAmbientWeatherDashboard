using System.Text.Json;
using System.Text.Json.Serialization;

namespace AmbientWeather.Infrastructure.Ambient;

/// <summary>
/// Shared <see cref="JsonSerializerOptions"/> for deserializing Ambient Weather API responses.
/// </summary>
public static class AmbientJsonOptions
{
    /// <summary>
    /// Web defaults with <see cref="JsonNumberHandling.AllowReadingFromString"/> to tolerate
    /// Ambient's occasional encoding of numeric fields as JSON strings.
    /// The runtime seals this instance on first use; do not add converters or modify properties.
    /// </summary>
    public static readonly JsonSerializerOptions Default = new(JsonSerializerDefaults.Web)
    {
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };
}
