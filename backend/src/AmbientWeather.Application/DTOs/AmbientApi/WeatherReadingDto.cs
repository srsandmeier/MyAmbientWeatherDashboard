using System.Text.Json.Serialization;

namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// A single weather reading from the device.
/// This represents a snapshot of all sensor values at a specific point in time.
/// </summary>
public record WeatherReadingDto : IAmbientSensorFields
{
    /// <summary>Gets the Unix timestamp in milliseconds (UTC).</summary>
    [JsonPropertyName("dateutc")]
    public long DateUtc { get; init; }

    /// <summary>Gets the indoor temperature in Fahrenheit.</summary>
    [JsonPropertyName("tempinf")]
    public double? TempInF { get; init; }

    /// <summary>Gets the indoor humidity percentage (0-100).</summary>
    [JsonPropertyName("humidityin")]
    public int? HumidityIn { get; init; }

    /// <summary>Gets the relative barometric pressure in inches of mercury.</summary>
    [JsonPropertyName("baromrelin")]
    public double? BaromRelIn { get; init; }

    /// <summary>Gets the absolute barometric pressure in inches of mercury.</summary>
    [JsonPropertyName("baromabsin")]
    public double? BaromAbsIn { get; init; }

    /// <summary>Gets the outdoor temperature in Fahrenheit.</summary>
    [JsonPropertyName("tempf")]
    public double? TempF { get; init; }

    /// <summary>Gets the outdoor sensor battery status. 1 = OK, 0 = Low/Critical.</summary>
    [JsonPropertyName("battout")]
    public int? BattOut { get; init; }

    /// <summary>Gets the outdoor humidity percentage (0-100).</summary>
    [JsonPropertyName("humidity")]
    public int? Humidity { get; init; }

    /// <summary>Gets the wind direction in degrees (0-360).</summary>
    [JsonPropertyName("winddir")]
    public int? WindDir { get; init; }

    /// <summary>Gets the current wind speed in miles per hour.</summary>
    [JsonPropertyName("windspeedmph")]
    public double? WindSpeedMph { get; init; }

    /// <summary>Gets the wind gust speed in miles per hour.</summary>
    [JsonPropertyName("windgustmph")]
    public double? WindGustMph { get; init; }

    /// <summary>Gets the maximum gust speed recorded in the past day in miles per hour.</summary>
    [JsonPropertyName("maxdailygust")]
    public double? MaxDailyGust { get; init; }

    /// <summary>Gets the rainfall in the past hour in inches.</summary>
    [JsonPropertyName("hourlyrainin")]
    public double? HourlyRainIn { get; init; }

    /// <summary>Gets the rainfall from the last recorded rain event in inches.</summary>
    [JsonPropertyName("eventrainin")]
    public double? EventRainIn { get; init; }

    /// <summary>Gets the rainfall accumulated today in inches.</summary>
    [JsonPropertyName("dailyrainin")]
    public double? DailyRainIn { get; init; }

    /// <summary>Gets the rainfall accumulated this week in inches.</summary>
    [JsonPropertyName("weeklyrainin")]
    public double? WeeklyRainIn { get; init; }

    /// <summary>Gets the rainfall accumulated this month in inches.</summary>
    [JsonPropertyName("monthlyrainin")]
    public double? MonthlyRainIn { get; init; }

    /// <summary>Gets the total rainfall accumulated since device setup in inches.</summary>
    [JsonPropertyName("totalrainin")]
    public double? TotalRainIn { get; init; }

    /// <summary>Gets the rainfall accumulated this year in inches.</summary>
    [JsonPropertyName("yearlyrainin")]
    public double? YearlyRainIn { get; init; }

    /// <summary>Gets the solar radiation in watts per square meter (W/m²).</summary>
    [JsonPropertyName("solarradiation")]
    public double? SolarRadiation { get; init; }

    /// <summary>Gets the UV index (0-11+).</summary>
    [JsonPropertyName("uv")]
    public int? Uv { get; init; }

    /// <summary>Gets the apparent temperature (wind chill or heat index) in Fahrenheit.</summary>
    [JsonPropertyName("feelsLike")]
    public double? FeelsLike { get; init; }

    /// <summary>Gets the dew point temperature in Fahrenheit.</summary>
    [JsonPropertyName("dewPoint")]
    public double? DewPoint { get; init; }

    /// <summary>Gets the indoor apparent temperature in Fahrenheit.</summary>
    [JsonPropertyName("feelsLikein")]
    public double? FeelsLikeIn { get; init; }

    /// <summary>Gets the indoor dew point temperature in Fahrenheit.</summary>
    [JsonPropertyName("dewPointin")]
    public double? DewPointIn { get; init; }

    /// <summary>Gets the ISO 8601 timestamp of the last recorded rainfall event.</summary>
    [JsonPropertyName("lastRain")]
    public DateTime? LastRain { get; init; }

    /// <summary>Gets the IANA timezone identifier for the device location (e.g., "America/Chicago").</summary>
    [JsonPropertyName("tz")]
    public string? Tz { get; init; }

    /// <summary>Gets the ISO 8601 timestamp of this reading in the device's local timezone.</summary>
    [JsonPropertyName("date")]
    public DateTime? Date { get; init; }
}
