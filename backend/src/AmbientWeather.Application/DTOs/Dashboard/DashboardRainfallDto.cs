namespace AmbientWeather.Application.DTOs.Dashboard;

/// <summary>
/// Rainfall accumulation snapshot for the user's default weather station.
/// All accumulation values are in inches (canonical Ambient unit); the frontend converts
/// to the user's preferred unit at the presentation boundary.
/// </summary>
public sealed record DashboardRainfallDto
{
    /// <summary>Normalized MAC address of the station that produced the reading.</summary>
    public required string DeviceId { get; init; }

    /// <summary>User-visible station name (nickname preferred, then provider name).</summary>
    public string? DeviceName { get; init; }

    /// <summary>Sensor-reported UTC timestamp of the reading, if available.</summary>
    public DateTime? TimestampUtc { get; init; }

    /// <summary>UTC timestamp when this reading was received from the Ambient pipeline.</summary>
    public required DateTime ReceivedAtUtc { get; init; }

    /// <summary>Accumulation for the last rain event, in inches.</summary>
    public double? EventRainIn { get; init; }

    /// <summary>Rolling 24-hour accumulation, in inches.</summary>
    public double? DailyRainIn { get; init; }

    /// <summary>Rolling 7-day accumulation, in inches.</summary>
    public double? WeeklyRainIn { get; init; }

    /// <summary>Rolling 30-day accumulation, in inches.</summary>
    public double? MonthlyRainIn { get; init; }

    /// <summary>Year-to-date accumulation, in inches.</summary>
    public double? YearlyRainIn { get; init; }

    /// <summary>UTC timestamp of the last rain event.</summary>
    public DateTime? LastRain { get; init; }
}
