using Bogus;

namespace AmbientWeather.UnitTests.TestData;

/// <summary>
/// Generated station-like test data. Values are intentionally different between test runs.
/// </summary>
public static class WeatherTestData
{
    private static readonly Faker F = new();

    /// <summary>Generated MAC-like identifier with no separators.</summary>
    public static string Mac { get; } = F.Random.Hexadecimal(12, string.Empty).ToUpperInvariant();

    /// <summary>Generated colon-separated MAC-like identifier.</summary>
    public static string ColonMac { get; } = string.Join(
        ":",
        Enumerable.Range(0, 6).Select(i => Mac.Substring(i * 2, 2)));

    /// <summary>Generated second MAC-like identifier with no separators.</summary>
    public static string OtherMac { get; } = F.Random.Hexadecimal(12, string.Empty).ToUpperInvariant();

    /// <summary>Generated station display name.</summary>
    public static string StationName { get; } = $"Generated station {F.Random.AlphaNumeric(4)}";

    /// <summary>Generated station nickname.</summary>
    public static string Nickname { get; } = $"Generated nickname {F.Random.AlphaNumeric(4)}";

    /// <summary>Generated public-source identifier.</summary>
    public static string SourceId { get; } = $"generated-{F.Random.AlphaNumeric(8)}";
}
