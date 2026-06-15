using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Neighbors;

namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Aggregates sensor readings from nearby public stations by computing the mean of each
/// field across all non-null values. Null exclusion ensures that stations missing a sensor
/// do not skew the average for that metric.
/// </summary>
public sealed class NeighborAggregationService : INeighborAggregationService
{
    /// <inheritdoc />
    public AggregatedNeighborReadingDto Aggregate(
        IReadOnlyList<NeighborStation> stations,
        int minStations)
    {
        if (stations.Count == 0)
        {
            return new AggregatedNeighborReadingDto
            {
                ContributingStationCount = 0,
                IsBelowMinStations = true,
            };
        }

        return new AggregatedNeighborReadingDto
        {
            TempF = MeanDouble(stations, s => s.TempF),
            Humidity = MeanInt(stations, s => s.Humidity),
            DewPoint = MeanDouble(stations, s => s.DewPoint),
            FeelsLike = MeanDouble(stations, s => s.FeelsLike),
            BaromRelIn = MeanDouble(stations, s => s.BaromRelIn),
            BaromAbsIn = MeanDouble(stations, s => s.BaromAbsIn),
            WindSpeedMph = MeanDouble(stations, s => s.WindSpeedMph),
            WindGustMph = MeanDouble(stations, s => s.WindGustMph),
            WindDir = MeanWindDir(stations),
            HourlyRainIn = MeanDouble(stations, s => s.HourlyRainIn),
            DailyRainIn = MeanDouble(stations, s => s.DailyRainIn),
            WeeklyRainIn = MeanDouble(stations, s => s.WeeklyRainIn),
            MonthlyRainIn = MeanDouble(stations, s => s.MonthlyRainIn),
            YearlyRainIn = MeanDouble(stations, s => s.YearlyRainIn),
            SolarRadiation = MeanDouble(stations, s => s.SolarRadiation),
            Uv = MeanInt(stations, s => s.Uv),
            DailyHighTempF = MaxDouble(stations, s => s.DailyHighTempF),
            DailyLowTempF = MinDouble(stations, s => s.DailyLowTempF),
            ContributingStationCount = stations.Count,
            IsBelowMinStations = stations.Count < minStations,
        };
    }

    private static double? MeanDouble(
        IReadOnlyList<NeighborStation> stations,
        Func<NeighborStation, double?> selector)
    {
        var values = stations
            .Select(selector)
            .Where(v => v.HasValue)
            .Select(v => v!.Value)
            .ToList();

        return values.Count > 0 ? values.Average() : null;
    }

    private static double? MaxDouble(
        IReadOnlyList<NeighborStation> stations,
        Func<NeighborStation, double?> selector)
    {
        var values = stations
            .Select(selector)
            .Where(v => v.HasValue)
            .Select(v => v!.Value)
            .ToList();

        return values.Count > 0 ? values.Max() : null;
    }

    private static double? MinDouble(
        IReadOnlyList<NeighborStation> stations,
        Func<NeighborStation, double?> selector)
    {
        var values = stations
            .Select(selector)
            .Where(v => v.HasValue)
            .Select(v => v!.Value)
            .ToList();

        return values.Count > 0 ? values.Min() : null;
    }

    private static int? MeanInt(
        IReadOnlyList<NeighborStation> stations,
        Func<NeighborStation, int?> selector)
    {
        var values = stations
            .Select(selector)
            .Where(v => v.HasValue)
            .Select(v => v!.Value)
            .ToList();

        return values.Count > 0 ? (int)Math.Round(values.Average()) : null;
    }

    /// <summary>
    /// Averages wind direction using circular mean to handle the 0°/360° wrap-around correctly.
    /// A simple arithmetic mean of [350°, 10°] would give 180° (wrong); circular mean gives 0°.
    /// </summary>
    private static int? MeanWindDir(IReadOnlyList<NeighborStation> stations)
    {
        var dirs = stations
            .Select(s => s.WindDir)
            .Where(v => v.HasValue)
            .Select(v => v!.Value * Math.PI / 180.0)
            .ToList();

        if (dirs.Count == 0) return null;

        var sinMean = dirs.Average(Math.Sin);
        var cosMean = dirs.Average(Math.Cos);
        var deg = Math.Atan2(sinMean, cosMean) * 180.0 / Math.PI;
        return (int)Math.Round((deg + 360) % 360);
    }
}
