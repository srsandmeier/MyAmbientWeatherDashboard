using System.Globalization;
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

    /// <summary>Generated latitude inside the US bounding box the public providers accept; new on each call.</summary>
    public static double Latitude() => F.Address.Latitude(min: 25, max: 49);

    /// <summary>Generated longitude inside the US bounding box the public providers accept; new on each call.</summary>
    public static double Longitude() => F.Address.Longitude(min: -124, max: -67);

    /// <summary>Formats a coordinate for a JSON fixture with an invariant decimal point.</summary>
    public static string Coordinate(double value) => value.ToString("F4", CultureInfo.InvariantCulture);

    /// <summary>A real US airport picked at random, for a fixture that needs a station code or a place name.</summary>
    public static TestAirport Airport() => F.PickRandom(Airports);

    private static readonly TestAirport[] Airports =
    [
        new("KATL", "ATL", "Hartsfield-Jackson Atlanta International Airport", "Atlanta", "GA"),
        new("KBOS", "BOS", "Boston Logan International Airport", "Boston", "MA"),
        new("KDEN", "DEN", "Denver International Airport", "Denver", "CO"),
        new("KDFW", "DFW", "Dallas Fort Worth International Airport", "Dallas", "TX"),
        new("KLAX", "LAX", "Los Angeles International Airport", "Los Angeles", "CA"),
        new("KMIA", "MIA", "Miami International Airport", "Miami", "FL"),
        new("KMSP", "MSP", "Minneapolis-Saint Paul International Airport", "Minneapolis", "MN"),
        new("KORD", "ORD", "Chicago OHare International Airport", "Chicago", "IL"),
        new("KPHX", "PHX", "Phoenix Sky Harbor International Airport", "Phoenix", "AZ"),
        new("KSEA", "SEA", "Seattle-Tacoma International Airport", "Seattle", "WA"),
    ];
}

/// <summary>A real US airport: its station codes, name, city and state abbreviation.</summary>
public sealed record TestAirport(string Icao, string Iata, string Name, string City, string State)
{
    /// <summary>The city and state as a search query.</summary>
    public string CityState => $"{City}, {State}";
}
