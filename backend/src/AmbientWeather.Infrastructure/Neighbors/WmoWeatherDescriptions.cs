namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Maps WMO Weather Interpretation Codes (WMO 4677) to human-readable descriptions.
/// Used by Open-Meteo <c>weather_code</c> current and daily fields.
/// </summary>
internal static class WmoWeatherDescriptions
{
    private static readonly Dictionary<int, string> Descriptions =
        new Dictionary<int, string>
        {
            [0] = "Clear sky",
            [1] = "Mainly clear",
            [2] = "Partly cloudy",
            [3] = "Overcast",
            [45] = "Fog",
            [48] = "Rime fog",
            [51] = "Light drizzle",
            [53] = "Moderate drizzle",
            [55] = "Dense drizzle",
            [56] = "Light freezing drizzle",
            [57] = "Heavy freezing drizzle",
            [61] = "Light rain",
            [63] = "Moderate rain",
            [65] = "Heavy rain",
            [66] = "Light freezing rain",
            [67] = "Heavy freezing rain",
            [71] = "Light snow",
            [73] = "Moderate snow",
            [75] = "Heavy snow",
            [77] = "Snow grains",
            [80] = "Light showers",
            [81] = "Moderate showers",
            [82] = "Heavy showers",
            [85] = "Light snow showers",
            [86] = "Heavy snow showers",
            [95] = "Thunderstorm",
            [96] = "Thunderstorm with hail",
            [99] = "Thunderstorm with heavy hail",
        };

    /// <summary>
    /// Returns the human-readable description for a WMO weather code,
    /// or <see langword="null"/> when the code is unrecognised or <paramref name="code"/> is <see langword="null"/>.
    /// </summary>
    public static string? Describe(int? code) =>
        code.HasValue && Descriptions.TryGetValue(code.Value, out var desc) ? desc : null;
}
