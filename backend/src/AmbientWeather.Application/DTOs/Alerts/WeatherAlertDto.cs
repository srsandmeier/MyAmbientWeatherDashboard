namespace AmbientWeather.Application.DTOs.Alerts;

/// <summary>
/// Active public weather alert for the user's station area.
/// </summary>
public sealed record WeatherAlertDto
{
    /// <summary>Provider alert identifier.</summary>
    public required string Id { get; init; }

    /// <summary>Alert event name.</summary>
    public string? Event { get; init; }

    /// <summary>Short alert headline.</summary>
    public string? Headline { get; init; }

    /// <summary>Long-form alert description.</summary>
    public string? Description { get; init; }

    /// <summary>NWS severity value.</summary>
    public string? Severity { get; init; }

    /// <summary>NWS urgency value.</summary>
    public string? Urgency { get; init; }

    /// <summary>NWS certainty value.</summary>
    public string? Certainty { get; init; }

    /// <summary>UTC instant when the alert becomes effective.</summary>
    public DateTime? EffectiveUtc { get; init; }

    /// <summary>UTC instant when the alert expires.</summary>
    public DateTime? ExpiresUtc { get; init; }

    /// <summary>Human-readable affected area description.</summary>
    public string? AreaDesc { get; init; }
}
