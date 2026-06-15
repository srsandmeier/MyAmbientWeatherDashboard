namespace AmbientWeather.Application.Features.PublicSources;

/// <summary>
/// Public weather providers that can be selected as dashboard sources.
/// </summary>
public static class PublicWeatherSourceProviders
{
    /// <summary>Weather.gov / National Weather Service provider key.</summary>
    public const string WeatherGov = "WeatherGov";

    /// <summary>Open-Meteo provider key.</summary>
    public const string OpenMeteo = "OpenMeteo";

    /// <summary>All supported public source provider keys.</summary>
    public static readonly IReadOnlyList<string> All = [WeatherGov, OpenMeteo];
}
