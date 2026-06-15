using AmbientWeather.Application.DTOs.Realtime;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

internal static class CurrentReadingCompleteness
{
    public static bool HasAnySensorValue(CurrentReadingDto reading) =>
        reading.TempF.HasValue ||
        reading.TempInF.HasValue ||
        reading.FeelsLike.HasValue ||
        reading.FeelsLikeIn.HasValue ||
        reading.DewPoint.HasValue ||
        reading.DewPointIn.HasValue ||
        reading.Humidity.HasValue ||
        reading.HumidityIn.HasValue ||
        reading.BaromRelIn.HasValue ||
        reading.BaromAbsIn.HasValue ||
        reading.WindDir.HasValue ||
        reading.WindSpeedMph.HasValue ||
        reading.WindGustMph.HasValue ||
        reading.MaxDailyGust.HasValue ||
        reading.HourlyRainIn.HasValue ||
        reading.EventRainIn.HasValue ||
        reading.DailyRainIn.HasValue ||
        reading.WeeklyRainIn.HasValue ||
        reading.MonthlyRainIn.HasValue ||
        reading.YearlyRainIn.HasValue ||
        reading.TotalRainIn.HasValue ||
        reading.SolarRadiation.HasValue ||
        reading.Uv.HasValue;
}
