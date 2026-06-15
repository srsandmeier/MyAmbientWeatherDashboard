using System.Globalization;

namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Formats Open-Meteo local date-time strings for display. Open-Meteo returns daily
/// sunrise/sunset values already converted to the station's local timezone (when the
/// request uses <c>timezone=auto</c> or an explicit zone), so no offset math is needed.
/// </summary>
internal static class OpenMeteoLocalTime
{
    /// <summary>
    /// Converts an Open-Meteo ISO-8601 local date-time string (e.g. "2026-06-10T06:42")
    /// to a short 12-hour time string (e.g. "6:42 AM").
    /// Returns <see langword="null"/> when the input is null, empty, or unparseable.
    /// </summary>
    public static string? Format(string? value)
    {
        return !string.IsNullOrWhiteSpace(value) &&
               DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt)
            ? dt.ToString("h:mm tt", CultureInfo.InvariantCulture)
            : null;
    }
}
