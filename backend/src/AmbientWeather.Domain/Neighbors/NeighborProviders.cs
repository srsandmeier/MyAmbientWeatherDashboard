namespace AmbientWeather.Domain.Neighbors;

/// <summary>Provider identifier constants for neighbor discovery.</summary>
public static class NeighborProviders
{
    /// <summary>Ambient Weather Open API neighbor provider.</summary>
    public const string AmbientOpen = "AmbientOpen";

    /// <summary>Weather.gov / National Weather Service neighbor provider.</summary>
    public const string WeatherGov = "WeatherGov";

    /// <summary>Open-Meteo neighbor provider.</summary>
    public const string OpenMeteo = "OpenMeteo";

    /// <summary>All supported neighbor providers.</summary>
    public static readonly IReadOnlyList<string> All =
    [
        AmbientOpen,
        WeatherGov,
        OpenMeteo,
    ];
}
