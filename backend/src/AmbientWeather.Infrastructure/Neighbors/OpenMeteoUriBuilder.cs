using System.Globalization;

namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Builds request URIs for the Open-Meteo Forecast API (<c>/v1/forecast</c>).
/// All callers share a single named HttpClient registered as <see cref="OpenMeteoNearbyBaselineProvider.HttpClientName"/>.
/// </summary>
internal static class OpenMeteoUriBuilder
{
    private const string ImperialUnits =
        "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch";

    private const string HourlyPrecip = "precipitation_probability";

    /// <summary>
    /// Current fields used by the neighbor baseline discovery endpoint.
    /// Uses <c>surface_pressure</c> (station-level) and includes <c>precipitation</c>.
    /// </summary>
    internal const string NeighborBaselineCurrentFields =
        "temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m," +
        "wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,precipitation," +
        "uv_index,weather_code,cloud_cover";

    /// <summary>Daily fields used by the neighbor baseline discovery endpoint.</summary>
    internal const string NeighborBaselineDailyFields =
        "temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,sunrise,sunset," +
        "wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant";

    /// <summary>
    /// Current fields used by the public-source current-reading endpoint.
    /// Uses <c>pressure_msl</c> (sea-level, more consistent across elevations) and omits <c>precipitation</c>.
    /// </summary>
    internal const string PublicSourceCurrentFields =
        "temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,pressure_msl," +
        "wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,weather_code,cloud_cover";

    /// <summary>Daily fields used by the public-source current-reading endpoint.</summary>
    internal const string PublicSourceDailyFields =
        "uv_index_max,precipitation_sum,sunrise,sunset," +
        "wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant";

    /// <summary>
    /// Builds the URI for the neighbor baseline discovery endpoint.
    /// Uses <c>timezone=auto</c> and no model override.
    /// </summary>
    internal static string BuildNeighborBaseline(double lat, double lon) =>
        string.Format(
            CultureInfo.InvariantCulture,
            "/v1/forecast?latitude={0:F4}&longitude={1:F4}&current={2}&hourly={3}&daily={4}{5}&forecast_days=1&timezone=auto",
            lat,
            lon,
            NeighborBaselineCurrentFields,
            HourlyPrecip,
            NeighborBaselineDailyFields,
            ImperialUnits);

    /// <summary>
    /// Builds the URI for a saved public-source current-reading request.
    /// Accepts a caller-supplied timezone string and requests the <c>best_match</c> model.
    /// </summary>
    internal static string BuildPublicSourceCurrentReading(double lat, double lon, string timezone) =>
        string.Format(
            CultureInfo.InvariantCulture,
            "/v1/forecast?latitude={0:F4}&longitude={1:F4}&current={2}&hourly={3}&daily={4}{5}&forecast_days=1&timezone={6}&models=best_match",
            lat,
            lon,
            PublicSourceCurrentFields,
            HourlyPrecip,
            PublicSourceDailyFields,
            ImperialUnits,
            Uri.EscapeDataString(timezone));

    /// <summary>
    /// Builds a minimal URI used only to probe the IANA timezone identifier for a coordinate pair.
    /// Requests the <c>best_match</c> model so the response includes the <c>timezone</c> field.
    /// </summary>
    internal static string BuildTimezoneProbe(double lat, double lon) =>
        string.Format(
            CultureInfo.InvariantCulture,
            "/v1/forecast?latitude={0:F4}&longitude={1:F4}&current=temperature_2m&forecast_days=1&timezone=auto&models=best_match",
            lat,
            lon);
}
