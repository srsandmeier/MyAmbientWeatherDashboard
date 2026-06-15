namespace AmbientWeather.Application.DTOs.Neighbors;

/// <summary>
/// Mean-aggregated sensor values across a set of nearby public stations, with
/// contributing-station metadata. Used internally by handlers before mapping to
/// <see cref="AmbientWeather.Application.DTOs.Realtime.CurrentReadingDto"/>.
/// </summary>
public sealed record AggregatedNeighborReadingDto
{
    /// <summary>Mean outdoor temperature in °F across contributing stations.</summary>
    public double? TempF { get; init; }

    /// <summary>Mean outdoor humidity percentage.</summary>
    public int? Humidity { get; init; }

    /// <summary>Mean outdoor dew point in °F.</summary>
    public double? DewPoint { get; init; }

    /// <summary>Mean apparent temperature (feels-like) in °F.</summary>
    public double? FeelsLike { get; init; }

    /// <summary>Mean relative barometric pressure in inHg.</summary>
    public double? BaromRelIn { get; init; }

    /// <summary>Mean absolute (station) barometric pressure in inHg.</summary>
    public double? BaromAbsIn { get; init; }

    /// <summary>Mean wind speed in mph.</summary>
    public double? WindSpeedMph { get; init; }

    /// <summary>Mean wind gust speed in mph.</summary>
    public double? WindGustMph { get; init; }

    /// <summary>Mean wind direction in degrees (circular mean).</summary>
    public int? WindDir { get; init; }

    /// <summary>Mean hourly rainfall rate in inches.</summary>
    public double? HourlyRainIn { get; init; }

    /// <summary>Mean daily rainfall accumulation in inches.</summary>
    public double? DailyRainIn { get; init; }

    /// <summary>Mean weekly rainfall accumulation in inches.</summary>
    public double? WeeklyRainIn { get; init; }

    /// <summary>Mean monthly rainfall accumulation in inches.</summary>
    public double? MonthlyRainIn { get; init; }

    /// <summary>Mean yearly rainfall accumulation in inches.</summary>
    public double? YearlyRainIn { get; init; }

    /// <summary>Mean solar radiation in W/m².</summary>
    public double? SolarRadiation { get; init; }

    /// <summary>Mean UV index.</summary>
    public int? Uv { get; init; }

    /// <summary>Maximum 24-hour high temperature in °F across contributing stations.</summary>
    public double? DailyHighTempF { get; init; }

    /// <summary>Minimum 24-hour low temperature in °F across contributing stations.</summary>
    public double? DailyLowTempF { get; init; }

    /// <summary>Number of stations that contributed at least one sensor reading.</summary>
    public int ContributingStationCount { get; init; }

    /// <summary>
    /// <see langword="true"/> when the contributing station count is below the user's
    /// configured minimum, indicating the aggregate may not be representative.
    /// </summary>
    public bool IsBelowMinStations { get; init; }
}
