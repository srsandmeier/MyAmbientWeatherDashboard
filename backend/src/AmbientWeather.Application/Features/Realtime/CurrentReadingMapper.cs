using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.Features.Realtime;

/// <summary>
/// Maps Ambient Weather API reading payloads to the canonical <see cref="CurrentReadingDto"/>.
/// Both the history-path <see cref="WeatherReadingDto"/> and the current-path
/// <see cref="DeviceDataDto"/> share identical sensor fields; this mapper produces a
/// single normalized shape used by the Redis cache, pub/sub pipeline, and BFF endpoint.
/// </summary>
public static class CurrentReadingMapper
{
    /// <summary>
    /// Creates a <see cref="CurrentReadingDto"/> from a history-endpoint reading and the
    /// owning station. Used when the realtime Socket.IO event delivers a payload that is
    /// structurally identical to a <see cref="WeatherReadingDto"/>.
    /// </summary>
    public static CurrentReadingDto FromWeatherReading(WeatherReadingDto reading, WeatherStation station) =>
        MapSensorFields(reading, station);

    /// <summary>
    /// Creates a <see cref="CurrentReadingDto"/> from a <c>GET /v1/devices</c> response
    /// reading and the owning station. Used by the <c>GET /api/dashboard/current</c> REST
    /// fallback path when no cached realtime reading is available.
    /// </summary>
    public static CurrentReadingDto FromDeviceData(DeviceDataDto data, WeatherStation station) =>
        MapSensorFields(data, station);

    private static CurrentReadingDto MapSensorFields(IAmbientSensorFields src, WeatherStation station) =>
        new()
        {
            DeviceId = station.MacAddress,
            DeviceName = station.Nickname ?? station.Name,
            TimestampUtc = DateTimeOffset.FromUnixTimeMilliseconds(src.DateUtc).UtcDateTime,
            ReceivedAtUtc = DateTime.UtcNow,
            TempF = src.TempF,
            BattOut = src.BattOut,
            TempInF = src.TempInF,
            FeelsLike = src.FeelsLike,
            FeelsLikeIn = src.FeelsLikeIn,
            DewPoint = src.DewPoint,
            DewPointIn = src.DewPointIn,
            Humidity = src.Humidity,
            HumidityIn = src.HumidityIn,
            BaromRelIn = src.BaromRelIn,
            BaromAbsIn = src.BaromAbsIn,
            WindDir = src.WindDir,
            WindSpeedMph = src.WindSpeedMph,
            WindGustMph = src.WindGustMph,
            MaxDailyGust = src.MaxDailyGust,
            HourlyRainIn = src.HourlyRainIn,
            EventRainIn = src.EventRainIn,
            DailyRainIn = src.DailyRainIn,
            WeeklyRainIn = src.WeeklyRainIn,
            MonthlyRainIn = src.MonthlyRainIn,
            YearlyRainIn = src.YearlyRainIn,
            TotalRainIn = src.TotalRainIn,
            LastRain = src.LastRain,
            SolarRadiation = src.SolarRadiation,
            Uv = src.Uv,
            Tz = src.Tz,
        };
}
