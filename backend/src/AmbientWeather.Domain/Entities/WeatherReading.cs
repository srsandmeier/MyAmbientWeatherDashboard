namespace AmbientWeather.Domain.Entities;

/// <summary>
/// Represents a single weather reading from a device at a specific point in time.
/// </summary>
public class WeatherReading
{
    /// <summary>
    /// Unique identifier for the reading record.
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// MAC address of the device that recorded this reading.
    /// </summary>
    public required string DeviceMacAddress { get; set; }

    /// <summary>
    /// Unix timestamp in milliseconds (UTC) when the reading was taken.
    /// </summary>
    public long DateUtc { get; set; }

    /// <summary>
    /// ISO 8601 timestamp converted from DateUtc for easier querying.
    /// </summary>
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    // Temperature readings
    public double? TempInF { get; set; }
    public double? TempF { get; set; }
    public double? FeelsLike { get; set; }
    public double? FeelsLikeIn { get; set; }

    // Humidity readings
    public int? HumidityIn { get; set; }
    public int? Humidity { get; set; }

    // Dew point
    public double? DewPoint { get; set; }
    public double? DewPointIn { get; set; }

    // Pressure readings
    public double? BaromRelIn { get; set; }
    public double? BaromAbsIn { get; set; }

    // Wind data
    public int? WindDir { get; set; }
    public double? WindSpeedMph { get; set; }
    public double? WindGustMph { get; set; }
    public double? MaxDailyGust { get; set; }

    // Rain data
    public double? HourlyRainIn { get; set; }
    public double? EventRainIn { get; set; }
    public double? DailyRainIn { get; set; }
    public double? WeeklyRainIn { get; set; }
    public double? MonthlyRainIn { get; set; }
    public double? YearlyRainIn { get; set; }
    public double? TotalRainIn { get; set; }

    // Solar and UV
    public double? SolarRadiation { get; set; }
    public int? Uv { get; set; }

    // Battery status
    public int? BattOut { get; set; }

    // Timezone info
    public string? Tz { get; set; }

    // Last rain event
    public DateTime? LastRain { get; set; }

    // Local date of the reading
    public DateTime? Date { get; set; }

    /// <summary>
    /// When this record was persisted to the database.
    /// </summary>
    public DateTime StoredAtUtc { get; set; } = DateTime.UtcNow;
}
