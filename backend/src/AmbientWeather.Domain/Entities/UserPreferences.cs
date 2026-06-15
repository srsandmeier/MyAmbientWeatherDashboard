namespace AmbientWeather.Domain.Entities;

/// <summary>
/// User-configurable units, theme, neighbour settings, and device display preferences.
/// </summary>
public sealed class UserPreferences
{
    /// <summary>
    /// User that owns these preferences.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Temperature unit preference.
    /// </summary>
    public string TemperatureUnit { get; set; } = "F";

    /// <summary>
    /// Speed unit preference.
    /// </summary>
    public string SpeedUnit { get; set; } = "mph";

    /// <summary>
    /// Pressure unit preference.
    /// </summary>
    public string PressureUnit { get; set; } = "inhg";

    /// <summary>
    /// Rainfall unit preference.
    /// </summary>
    public string RainfallUnit { get; set; } = "in";

    /// <summary>
    /// Distance unit preference.
    /// </summary>
    public string DistanceUnit { get; set; } = "mi";

    /// <summary>
    /// Theme preference.
    /// </summary>
    public string Theme { get; set; } = "system";

    /// <summary>
    /// Date display format preference.
    /// </summary>
    public string DateFormat { get; set; } = "mdy";

    /// <summary>
    /// Number of decimal places to show for temperature values: 0, 1, or 2.
    /// </summary>
    public int TemperatureDecimals { get; set; } = 1;

    /// <summary>
    /// Calendar-day timezone used for daily aggregate metrics (today's high/low) and
    /// history <c>range=date</c> queries: <c>utc</c> or <c>local</c>.
    /// When <c>local</c>, the station's IANA timezone is used; falls back to UTC when unavailable.
    /// </summary>
    public string DailyExtremaTimezone { get; set; } = "local";

    /// <summary>
    /// Neighbor comparison configuration JSON.
    /// </summary>
    public string NeighborConfigJson { get; set; } = "{}";

    /// <summary>
    /// Default selected device identifier.
    /// </summary>
    public Guid? DefaultWeatherStationId { get; set; }

    /// <summary>
    /// UTC timestamp when preferences were last updated.
    /// </summary>
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// User that owns these preferences.
    /// </summary>
    public AppUser? User { get; set; }

    /// <summary>
    /// Navigation to the default station, when one is selected.
    /// </summary>
    public WeatherStation? DefaultWeatherStation { get; set; }
}
