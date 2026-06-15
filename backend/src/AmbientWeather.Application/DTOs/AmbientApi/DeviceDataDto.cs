using System.Text.Json.Serialization;

namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// Represents the most recent sensor reading payload returned inside a device response.
/// </summary>
public record DeviceDataDto : IAmbientSensorFields
{
    /// <summary>Gets the observation timestamp as Unix milliseconds.</summary>
    [JsonPropertyName("dateutc")]
    public long DateUtc { get; init; }

    /// <summary>Gets the indoor temperature in °F.</summary>
    [JsonPropertyName("tempinf")]
    public double? TempInF { get; init; }

    /// <summary>Gets the indoor relative humidity percentage.</summary>
    [JsonPropertyName("humidityin")]
    public int? HumidityIn { get; init; }

    /// <summary>Gets the relative barometric pressure in inHg.</summary>
    [JsonPropertyName("baromrelin")]
    public double? BaromRelIn { get; init; }

    /// <summary>Gets the absolute barometric pressure in inHg.</summary>
    [JsonPropertyName("baromabsin")]
    public double? BaromAbsIn { get; init; }

    /// <summary>Gets the outdoor temperature in °F.</summary>
    [JsonPropertyName("tempf")]
    public double? TempF { get; init; }

    /// <summary>Gets the outdoor battery status.</summary>
    [JsonPropertyName("battout")]
    public int? BattOut { get; init; }

    /// <summary>Gets the outdoor relative humidity percentage.</summary>
    [JsonPropertyName("humidity")]
    public int? Humidity { get; init; }

    /// <summary>Gets the wind direction in degrees.</summary>
    [JsonPropertyName("winddir")]
    public int? WindDir { get; init; }

    /// <summary>Gets the wind speed in mph.</summary>
    [JsonPropertyName("windspeedmph")]
    public double? WindSpeedMph { get; init; }

    /// <summary>Gets the wind gust speed in mph.</summary>
    [JsonPropertyName("windgustmph")]
    public double? WindGustMph { get; init; }

    /// <summary>Gets the maximum daily wind gust in mph.</summary>
    [JsonPropertyName("maxdailygust")]
    public double? MaxDailyGust { get; init; }

    /// <summary>Gets the hourly rainfall accumulation in inches.</summary>
    [JsonPropertyName("hourlyrainin")]
    public double? HourlyRainIn { get; init; }

    /// <summary>Gets the per-event rainfall accumulation in inches.</summary>
    [JsonPropertyName("eventrainin")]
    public double? EventRainIn { get; init; }

    /// <summary>Gets the daily rainfall accumulation in inches.</summary>
    [JsonPropertyName("dailyrainin")]
    public double? DailyRainIn { get; init; }

    /// <summary>Gets the weekly rainfall accumulation in inches.</summary>
    [JsonPropertyName("weeklyrainin")]
    public double? WeeklyRainIn { get; init; }

    /// <summary>Gets the monthly rainfall accumulation in inches.</summary>
    [JsonPropertyName("monthlyrainin")]
    public double? MonthlyRainIn { get; init; }

    /// <summary>Gets the total rainfall accumulation in inches.</summary>
    [JsonPropertyName("totalrainin")]
    public double? TotalRainIn { get; init; }

    /// <summary>Gets the yearly rainfall accumulation in inches.</summary>
    [JsonPropertyName("yearlyrainin")]
    public double? YearlyRainIn { get; init; }

    /// <summary>Gets the solar radiation in W/m².</summary>
    [JsonPropertyName("solarradiation")]
    public double? SolarRadiation { get; init; }

    /// <summary>Gets the UV index.</summary>
    [JsonPropertyName("uv")]
    public int? Uv { get; init; }

    /// <summary>Gets the outdoor feels-like temperature in °F.</summary>
    [JsonPropertyName("feelsLike")]
    public double? FeelsLike { get; init; }

    /// <summary>Gets the outdoor dew point in °F.</summary>
    [JsonPropertyName("dewPoint")]
    public double? DewPoint { get; init; }

    /// <summary>Gets the indoor feels-like temperature in °F.</summary>
    [JsonPropertyName("feelsLikein")]
    public double? FeelsLikeIn { get; init; }

    /// <summary>Gets the indoor dew point in °F.</summary>
    [JsonPropertyName("dewPointin")]
    public double? DewPointIn { get; init; }

    /// <summary>Gets the timestamp of the last recorded rain event.</summary>
    [JsonPropertyName("lastRain")]
    public DateTime? LastRain { get; init; }

    /// <summary>Gets the IANA time zone identifier for the station.</summary>
    [JsonPropertyName("tz")]
    public string? Tz { get; init; }

    /// <summary>Gets the observation date as a parsed <see cref="DateTime"/>.</summary>
    [JsonPropertyName("date")]
    public DateTime? Date { get; init; }
}
