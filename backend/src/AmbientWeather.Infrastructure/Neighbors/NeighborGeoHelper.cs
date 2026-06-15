namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Haversine distance, bounding-box, and US-coverage helpers used by neighbor providers.
/// </summary>
internal static class NeighborGeoHelper
{
    private const double EarthRadiusMiles = 3_958.8;

    /// <summary>
    /// Returns the great-circle distance in miles between two coordinates.
    /// </summary>
    internal static double HaversineDistanceMiles(
        double lat1, double lon1,
        double lat2, double lon2)
    {
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2))
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return EarthRadiusMiles * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    /// <summary>
    /// Returns the SW/NE corners of a bounding box centred on <paramref name="lat"/>,
    /// <paramref name="lon"/> with side half-length <paramref name="radiusMiles"/>.
    /// </summary>
    internal static (double SwLat, double SwLon, double NeLat, double NeLon) BoundingBox(
        double lat, double lon, double radiusMiles)
    {
        var latDelta = radiusMiles / EarthRadiusMiles * (180.0 / Math.PI);
        var lonDelta = latDelta / Math.Cos(ToRadians(lat));
        return (lat - latDelta, lon - lonDelta, lat + latDelta, lon + lonDelta);
    }

    /// <summary>
    /// Returns <c>true</c> when the coordinate falls within the combined US bounding box
    /// (CONUS + Alaska + Hawaii + territories: lat 17–72°N, lon 180–60°W).
    /// </summary>
    internal static bool IsWithinUsBoundingBox(double lat, double lon) =>
        lat is >= 17.0 and <= 72.0 && lon is >= -180.0 and <= -60.0;

    /// <summary>
    /// Approximates dew point in °F using the Magnus formula.
    /// Returns <c>null</c> when either input is absent.
    /// </summary>
    internal static double? ApproximateDewPointF(double? tempF, double? humidityPct)
    {
        if (tempF is null || humidityPct is null) return null;
        var tempC = (tempF.Value - 32.0) * 5.0 / 9.0;
        const double b = 17.62, c = 243.12;
        var gamma = Math.Log(humidityPct.Value / 100.0) + b * tempC / (c + tempC);
        var dewC = c * gamma / (b - gamma);
        return dewC * 9.0 / 5.0 + 32.0;
    }

    /// <summary>
    /// Approximates feels-like temperature in °F.
    /// Uses heat index above 80 °F with humidity ≥ 40 %, wind chill below 50 °F with
    /// wind ≥ 3 mph, otherwise returns the dry-bulb temperature.
    /// </summary>
    internal static double? ApproximateFeelsLikeF(
        double? tempF, double? humidityPct, double? windSpeedMph)
    {
        if (tempF is null) return null;
        var t = tempF.Value;
        var h = humidityPct ?? 0;
        var w = windSpeedMph ?? 0;

        if (t >= 80 && h >= 40)
        {
            // Rothfusz heat index regression
            return -42.379 + 2.04901523 * t + 10.14333127 * h
                - 0.22475541 * t * h - 6.83783e-3 * t * t - 5.481717e-2 * h * h
                + 1.22874e-3 * t * t * h + 8.5282e-4 * t * h * h
                - 1.99e-6 * t * t * h * h;
        }

        if (t <= 50 && w >= 3)
        {
            // NWS wind chill
            return 35.74 + 0.6215 * t - 35.75 * Math.Pow(w, 0.16) + 0.4275 * t * Math.Pow(w, 0.16);
        }

        return t;
    }

    private static double ToRadians(double degrees) => degrees * (Math.PI / 180.0);

    // ── NWS / Open-Meteo unit conversions ────────────────────────────────────

    /// <summary>Converts Celsius to Fahrenheit; returns <c>null</c> when the input is absent.</summary>
    internal static double? CelsiusToF(double? c) => c.HasValue ? c.Value * 9.0 / 5.0 + 32.0 : null;

    /// <summary>Converts km/h to mph; returns <c>null</c> when the input is absent.</summary>
    internal static double? KmhToMph(double? kmh) => kmh.HasValue ? kmh.Value * 0.621371 : null;

    /// <summary>Converts Pascals to inches of mercury; returns <c>null</c> when the input is absent.</summary>
    internal static double? PaToInHg(double? pa) => pa.HasValue ? pa.Value * 0.000295300 : null;

    /// <summary>Converts hectopascals to inches of mercury; returns <c>null</c> when the input is absent.</summary>
    internal static double? HpaToInHg(double? hpa) => hpa.HasValue ? hpa.Value * 0.029529983 : null;

    /// <summary>Rounds a nullable double to the nearest integer; returns <c>null</c> when the input is absent.</summary>
    internal static int? RoundToInt(double? v) => v.HasValue ? (int)Math.Round(v.Value) : null;
}
