namespace AmbientWeather.Domain.Neighbors;

/// <summary>
/// A nearby public weather station discovered by an <see cref="INearbyWeatherProvider"/>.
/// Carries the most recent observation fields used for aggregation and display.
/// All temperature values are in °F, speed in mph, pressure in inHg.
/// </summary>
public sealed class NeighborStation
{
    /// <summary>
    /// Provider that supplied this station: <c>AmbientOpen</c>, <c>WeatherGov</c>,
    /// or <c>OpenMeteo</c>.
    /// </summary>
    public required string Provider { get; init; }

    /// <summary>
    /// Provider-assigned station identifier (MAC address, NWS station ID, etc.).
    /// </summary>
    public required string SourceId { get; init; }

    /// <summary>
    /// Human-readable station name. Null when the provider does not supply one.
    /// </summary>
    public string? Name { get; init; }

    /// <summary>
    /// How this station-like result was discovered: <c>city</c>, <c>county</c>,
    /// <c>airport</c>, or <c>station-location</c>.
    /// </summary>
    public string? DiscoveryKind { get; init; }

    /// <summary>
    /// Station latitude in decimal degrees.
    /// </summary>
    public double Lat { get; init; }

    /// <summary>
    /// Station longitude in decimal degrees.
    /// </summary>
    public double Lon { get; init; }

    /// <summary>
    /// Distance from the user's primary station in miles.
    /// </summary>
    public double DistanceMiles { get; init; }

    /// <summary>
    /// UTC timestamp of the station's most recent observation. Null when unavailable.
    /// </summary>
    public DateTime? LastObservedAtUtc { get; init; }

    /// <summary>
    /// Age of the observation in minutes at discovery time. Null when <see cref="LastObservedAtUtc"/>
    /// is unavailable.
    /// </summary>
    public int? FreshnessMinutes { get; init; }

    // ── Sensor fields (°F / mph / inHg / %) ─────────────────────────────────

    /// <summary>Outdoor temperature in °F.</summary>
    public double? TempF { get; init; }

    /// <summary>Outdoor humidity percentage.</summary>
    public int? Humidity { get; init; }

    /// <summary>Outdoor dew point in °F.</summary>
    public double? DewPoint { get; init; }

    /// <summary>Apparent temperature (feels-like) in °F.</summary>
    public double? FeelsLike { get; init; }

    /// <summary>Relative barometric pressure in inHg.</summary>
    public double? BaromRelIn { get; init; }

    /// <summary>Absolute (station) barometric pressure in inHg.</summary>
    public double? BaromAbsIn { get; init; }

    /// <summary>Wind speed in mph.</summary>
    public double? WindSpeedMph { get; init; }

    /// <summary>Wind gust speed in mph.</summary>
    public double? WindGustMph { get; init; }

    /// <summary>Wind direction in degrees (0–360).</summary>
    public int? WindDir { get; init; }

    /// <summary>Hourly rainfall rate in inches.</summary>
    public double? HourlyRainIn { get; init; }

    /// <summary>Daily rainfall accumulation in inches.</summary>
    public double? DailyRainIn { get; init; }

    /// <summary>Weekly rainfall accumulation in inches.</summary>
    public double? WeeklyRainIn { get; init; }

    /// <summary>Monthly rainfall accumulation in inches.</summary>
    public double? MonthlyRainIn { get; init; }

    /// <summary>Yearly rainfall accumulation in inches.</summary>
    public double? YearlyRainIn { get; init; }

    /// <summary>Solar radiation in W/m².</summary>
    public double? SolarRadiation { get; init; }

    /// <summary>UV index.</summary>
    public int? Uv { get; init; }

    /// <summary>24-hour high temperature in °F. Null when not available from the provider.</summary>
    public double? DailyHighTempF { get; init; }

    /// <summary>24-hour low temperature in °F. Null when not available from the provider.</summary>
    public double? DailyLowTempF { get; init; }

    // ── NWS text fields (WeatherGov only) ────────────────────────────────────

    /// <summary>Formatted cloud layer summary, e.g. "FEW @ 1,800ft, OVC @ 5,000ft". Null when not available.</summary>
    public string? SkyConditions { get; init; }

    /// <summary>Present weather phenomena, e.g. "Light Rain, Mist". Null when not available.</summary>
    public string? PresentWeather { get; init; }

    /// <summary>NWS plain-text observation summary. Null when not available.</summary>
    public string? TextDescription { get; init; }

    /// <summary>Raw METAR string. Null when not available.</summary>
    public string? RawMetar { get; init; }

    // ── Open-Meteo extended fields (OpenMeteo provider only) ─────────────────

    /// <summary>Cloud cover percentage (0–100). Null when not available.</summary>
    public int? OmCloudCover { get; init; }

    /// <summary>Precipitation probability percentage for the current hour (0–100). Null when not available.</summary>
    public int? OmPrecipProbability { get; init; }

    /// <summary>Human-readable WMO weather description, e.g. "Partly cloudy". Null when not available.</summary>
    public string? OmWeatherDescription { get; init; }

    /// <summary>Sunrise local time string, e.g. "6:42 AM". Null when not available.</summary>
    public string? OmSunrise { get; init; }

    /// <summary>Sunset local time string, e.g. "8:15 PM". Null when not available.</summary>
    public string? OmSunset { get; init; }

    /// <summary>Daily UV index maximum. Null when not available.</summary>
    public int? OmUvIndexMax { get; init; }

    /// <summary>Daily precipitation sum in inches. Null when not available.</summary>
    public double? OmPrecipSumIn { get; init; }

    /// <summary>Daily maximum wind speed in mph. Null when not available.</summary>
    public double? OmWindSpeedMax { get; init; }

    /// <summary>Daily maximum wind gust in mph. Null when not available.</summary>
    public double? OmWindGustMax { get; init; }

    /// <summary>Daily dominant wind direction in degrees. Null when not available.</summary>
    public int? OmWindDirDominant { get; init; }
}
