using System.Globalization;
using System.Text;

namespace AmbientWeather.Infrastructure.Neighbors;

/// <summary>
/// Formats raw NWS observation text fields into human-readable strings.
/// Used by both <see cref="WeatherGovNearbyObservationProvider"/> and
/// <see cref="PublicSources.PublicSourceCurrentReadingService"/>.
/// </summary>
internal static class NwsTextFormatter
{
    private const double MetersToFeet = 3.28084;

    /// <summary>
    /// Converts an NWS cloud-layers array into a compact display string such as
    /// <c>"FEW @ 1,800ft, BKN @ 5,000ft"</c>.
    /// Returns <see langword="null"/> when the list is empty or all entries lack coverage.
    /// </summary>
    public static string? FormatCloudLayers(IReadOnlyList<NwsResponseTypes.NwsCloudLayer>? layers)
    {
        if (layers is not { Count: > 0 }) return null;

        var sb = new StringBuilder();
        foreach (var layer in layers)
        {
            if (string.IsNullOrWhiteSpace(layer.Coverage)) continue;

            var abbr = AbbreviateCoverage(layer.Coverage);
            if (sb.Length > 0) sb.Append(", ");
            sb.Append(abbr);

            if (layer.BaseHeight?.Value is double meters)
            {
                var feet = (int)(Math.Round(meters * MetersToFeet / 100.0) * 100);
                sb.Append(" @ ");
                sb.Append(feet.ToString("N0", CultureInfo.InvariantCulture));
                sb.Append("ft");
            }
        }

        return sb.Length > 0 ? sb.ToString() : null;
    }

    /// <summary>
    /// Joins non-empty <c>rawString</c> values from an NWS present-weather array
    /// into a comma-separated string such as <c>"Light Rain, Mist"</c>.
    /// Returns <see langword="null"/> when no non-empty entries exist.
    /// </summary>
    public static string? FormatPresentWeather(IReadOnlyList<NwsResponseTypes.NwsPresentWeatherItem>? items)
    {
        if (items is not { Count: > 0 }) return null;

        var parts = items
            .Select(i => i.RawString)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();

        return parts.Count > 0 ? string.Join(", ", parts) : null;
    }

    private static string AbbreviateCoverage(string coverage) =>
        coverage.ToLowerInvariant() switch
        {
            "clear" or "sky_clear" or "skc" => "CLR",
            "few" => "FEW",
            "scattered" or "sct" => "SCT",
            "broken" or "bkn" => "BKN",
            "overcast" or "ovc" => "OVC",
            "obscured" or "vv" => "VV",
            _ => coverage.ToUpperInvariant(),
        };
}
