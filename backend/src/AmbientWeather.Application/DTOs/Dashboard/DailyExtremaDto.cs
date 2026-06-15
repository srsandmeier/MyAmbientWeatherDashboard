namespace AmbientWeather.Application.DTOs.Dashboard;

/// <summary>
/// Daily high/low temperature snapshot computed from stored readings for the current UTC calendar day.
/// All temperature values are in °F (canonical unit); the frontend converts to the user's preferred
/// temperature unit at the presentation boundary.
/// </summary>
public sealed record DailyExtremaDto
{
    /// <summary>Normalized MAC address of the station.</summary>
    public required string DeviceId { get; init; }

    /// <summary>User-visible station name (nickname preferred, then provider name).</summary>
    public string? DeviceName { get; init; }

    /// <summary>The UTC calendar date for which extrema were computed (midnight UTC).</summary>
    public required DateTime DateUtc { get; init; }

    /// <summary>Highest outdoor temperature recorded today, in °F. Null when no readings exist.</summary>
    public double? DailyHighTempF { get; init; }

    /// <summary>Lowest outdoor temperature recorded today, in °F. Null when no readings exist.</summary>
    public double? DailyLowTempF { get; init; }

    /// <summary>Highest indoor temperature recorded today, in °F. Null when no readings exist.</summary>
    public double? DailyHighTempInF { get; init; }

    /// <summary>Lowest indoor temperature recorded today, in °F. Null when no readings exist.</summary>
    public double? DailyLowTempInF { get; init; }
}
