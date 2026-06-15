namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// Sensor fields shared by both <see cref="WeatherReadingDto"/> (history path) and
/// <see cref="DeviceDataDto"/> (current-reading path). Implementing this interface allows
/// <see cref="AmbientWeather.Application.Features.Realtime.CurrentReadingMapper"/> to map
/// either source type through a single code path, preventing silent field omissions when
/// new sensor properties are added to <c>CurrentReadingDto</c>.
/// </summary>
public interface IAmbientSensorFields
{
    /// <summary>Gets the Unix timestamp in milliseconds (UTC).</summary>
    long DateUtc { get; }

    /// <summary>Gets the outdoor temperature in °F.</summary>
    double? TempF { get; }

    /// <summary>Gets the outdoor sensor battery status. 1 = OK, 0 = Low/Critical.</summary>
    int? BattOut { get; }

    /// <summary>Gets the indoor temperature in °F.</summary>
    double? TempInF { get; }

    /// <summary>Gets the outdoor apparent temperature in °F.</summary>
    double? FeelsLike { get; }

    /// <summary>Gets the indoor apparent temperature in °F.</summary>
    double? FeelsLikeIn { get; }

    /// <summary>Gets the outdoor dew point in °F.</summary>
    double? DewPoint { get; }

    /// <summary>Gets the indoor dew point in °F.</summary>
    double? DewPointIn { get; }

    /// <summary>Gets the outdoor humidity percentage.</summary>
    int? Humidity { get; }

    /// <summary>Gets the indoor humidity percentage.</summary>
    int? HumidityIn { get; }

    /// <summary>Gets the relative barometric pressure in inHg.</summary>
    double? BaromRelIn { get; }

    /// <summary>Gets the absolute barometric pressure in inHg.</summary>
    double? BaromAbsIn { get; }

    /// <summary>Gets the wind direction in degrees.</summary>
    int? WindDir { get; }

    /// <summary>Gets the wind speed in mph.</summary>
    double? WindSpeedMph { get; }

    /// <summary>Gets the wind gust speed in mph.</summary>
    double? WindGustMph { get; }

    /// <summary>Gets the maximum daily wind gust in mph.</summary>
    double? MaxDailyGust { get; }

    /// <summary>Gets the hourly rainfall in inches.</summary>
    double? HourlyRainIn { get; }

    /// <summary>Gets the per-event rainfall in inches.</summary>
    double? EventRainIn { get; }

    /// <summary>Gets the daily rainfall in inches.</summary>
    double? DailyRainIn { get; }

    /// <summary>Gets the weekly rainfall in inches.</summary>
    double? WeeklyRainIn { get; }

    /// <summary>Gets the monthly rainfall in inches.</summary>
    double? MonthlyRainIn { get; }

    /// <summary>Gets the yearly rainfall in inches.</summary>
    double? YearlyRainIn { get; }

    /// <summary>Gets the total rainfall since factory reset in inches.</summary>
    double? TotalRainIn { get; }

    /// <summary>Gets the timestamp of the last rain event.</summary>
    DateTime? LastRain { get; }

    /// <summary>Gets the solar radiation in W/m².</summary>
    double? SolarRadiation { get; }

    /// <summary>Gets the UV index.</summary>
    int? Uv { get; }

    /// <summary>Gets the IANA timezone identifier.</summary>
    string? Tz { get; }
}
