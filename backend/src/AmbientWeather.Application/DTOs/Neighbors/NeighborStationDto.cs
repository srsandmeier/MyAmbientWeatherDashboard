using AmbientWeather.Domain.Neighbors;

namespace AmbientWeather.Application.DTOs.Neighbors;

/// <summary>
/// A discovered nearby public weather station returned by <c>POST /api/neighbors/refresh</c>.
/// All temperature values are in °F, speed in mph, pressure in inHg.
/// </summary>
public sealed record NeighborStationDto
{
    /// <summary>Provider name: <c>AmbientOpen</c>, <c>WeatherGov</c>, or <c>OpenMeteo</c>.</summary>
    public required string Provider { get; init; }

    /// <summary>Provider-assigned station identifier.</summary>
    public required string SourceId { get; init; }

    /// <summary>Human-readable station name.</summary>
    public string? Name { get; init; }

    /// <summary>How the station-like result was matched: city, county, airport, or station-location.</summary>
    public string? DiscoveryKind { get; init; }

    /// <summary>Station latitude in decimal degrees.</summary>
    public required double Lat { get; init; }

    /// <summary>Station longitude in decimal degrees.</summary>
    public required double Lon { get; init; }

    /// <summary>Distance from the user's primary station in miles.</summary>
    public required double DistanceMiles { get; init; }

    /// <summary>UTC timestamp of the station's most recent observation.</summary>
    public DateTime? LastObservedAtUtc { get; init; }

    /// <summary>Age of the observation in minutes at discovery time.</summary>
    public int? FreshnessMinutes { get; init; }

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

    /// <summary>Wind direction in degrees.</summary>
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

    /// <summary>
    /// Maps a <see cref="NeighborStation"/> domain object to a <see cref="NeighborStationDto"/>.
    /// </summary>
    public static NeighborStationDto From(NeighborStation s) => new()
    {
        Provider = s.Provider,
        SourceId = s.SourceId,
        Name = s.Name,
        DiscoveryKind = s.DiscoveryKind,
        Lat = s.Lat,
        Lon = s.Lon,
        DistanceMiles = s.DistanceMiles,
        LastObservedAtUtc = s.LastObservedAtUtc,
        FreshnessMinutes = s.FreshnessMinutes,
        TempF = s.TempF,
        Humidity = s.Humidity,
        DewPoint = s.DewPoint,
        FeelsLike = s.FeelsLike,
        BaromRelIn = s.BaromRelIn,
        BaromAbsIn = s.BaromAbsIn,
        WindSpeedMph = s.WindSpeedMph,
        WindGustMph = s.WindGustMph,
        WindDir = s.WindDir,
        HourlyRainIn = s.HourlyRainIn,
        DailyRainIn = s.DailyRainIn,
        WeeklyRainIn = s.WeeklyRainIn,
        MonthlyRainIn = s.MonthlyRainIn,
        YearlyRainIn = s.YearlyRainIn,
        SolarRadiation = s.SolarRadiation,
        Uv = s.Uv,
    };
}
