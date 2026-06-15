using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Domain.Metrics;

namespace AmbientWeather.Application.Features.Metrics;

/// <summary>
/// Maps metric keys to Ambient Weather reading field selectors for history chart queries.
/// Key support lives in this class because chartable history requires a concrete
/// <see cref="WeatherReadingDto"/> selector in addition to a registry definition.
/// </summary>
public static class HistoryMetricMap
{
    private sealed record MetricEntry(Func<WeatherReadingDto, double?> Selector);

    private static readonly Dictionary<string, MetricEntry> Entries =
        new(StringComparer.OrdinalIgnoreCase)
        {
            // Scalar metrics — chart value is the raw reading.
            ["wind_dir"] = new(r => (double?)r.WindDir),
            ["outdoor_temp"] = new(r => r.TempF),
            ["indoor_temp"] = new(r => r.TempInF),
            ["outdoor_humidity"] = new(r => (double?)r.Humidity),
            ["indoor_humidity"] = new(r => (double?)r.HumidityIn),
            ["pressure"] = new(r => r.BaromRelIn),
            ["uv_index"] = new(r => (double?)r.Uv),
            ["solar_radiation"] = new(r => r.SolarRadiation),
            ["wind_speed"] = new(r => r.WindSpeedMph),

            ["wind_gust"] = new(r => r.WindGustMph),
            ["max_daily_gust"] = new(r => r.MaxDailyGust),
            ["feels_like"] = new(r => r.FeelsLike),
            ["indoor_feels_like"] = new(r => r.FeelsLikeIn),
            ["dew_point"] = new(r => r.DewPoint),
            ["indoor_dew_point"] = new(r => r.DewPointIn),

            // Rainfall chart metrics — all use hourlyrainin bucket sums.
            // Snapshot fields (dailyrainin, etc.) are tile/current values only.
            ["rainfall_event"] = new(r => r.HourlyRainIn),
            ["rainfall_day"] = new(r => r.HourlyRainIn),
            ["rainfall_week"] = new(r => r.HourlyRainIn),
            ["rainfall_month"] = new(r => r.HourlyRainIn),
            ["rainfall_year"] = new(r => r.HourlyRainIn),
        };

    /// <summary>Gets all supported metric key strings.</summary>
    public static IReadOnlyCollection<string> SupportedKeys => Entries.Keys.ToList();

    /// <summary>Returns <see langword="true"/> when <paramref name="key"/> has an entry in the map.</summary>
    public static bool IsSupported(string? key) => key is not null && Entries.ContainsKey(key);

    /// <summary>
    /// Tries to resolve the value extractor, unit label, and rainfall flag for the given key.
    /// </summary>
    /// <returns><see langword="true"/> when found; <see langword="false"/> otherwise.</returns>
    public static bool TryGet(
        string key,
        out Func<WeatherReadingDto, double?> selector,
        out string unit,
        out bool isRainfall)
    {
        if (Entries.TryGetValue(key, out var entry)
            && MetricRegistry.TryGet(key, out var def))
        {
            selector = entry.Selector;
            unit = def.UnitFamily switch
            {
                MetricUnitFamily.Temperature => "F",
                MetricUnitFamily.Humidity => "%",
                MetricUnitFamily.Pressure => "inHg",
                MetricUnitFamily.WindSpeed => "mph",
                MetricUnitFamily.Rainfall => "in",
                MetricUnitFamily.SolarRadiation => "W/m²",
                MetricUnitFamily.UvIndex => "",
                MetricUnitFamily.WindDirection => "°",
                _ => "",
            };
            isRainfall = def.Category == MetricCategory.Rainfall;
            return true;
        }

        selector = _ => null;
        unit = string.Empty;
        isRainfall = false;
        return false;
    }
}
